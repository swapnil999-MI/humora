# Shared helpers for the Humora all-in-one scripts. Sourced, not executed.
# shellcheck shell=bash

DATA=${HUMORA_DATA:-/data}
PGDATA=$DATA/postgres
PG_SOCKET=/var/run/postgresql
PG_MAJOR=$(postgres --version | sed -E 's/.* ([0-9]+)\..*/\1/')
# Held for the lifetime of a running server; restores take it too, so they can never
# run against a live database (works across containers sharing the volume).
LOCK_FILE=$DATA/.humora.lock

log()  { echo "[humora] $*"; }
fail() { echo "[humora] ERROR: $*" >&2; exit 1; }
random_secret() { od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'; }
timestamp() { date -u +%Y%m%dT%H%M%SZ; }

run_as() { local u=$1; shift; setpriv --reuid="$u" --regid="$u" --init-groups -- "$@"; }
# Starts a service in the background as user $1; $! is the service's own PID (setpriv execs into it).
spawn_as() { local u=$1; shift; setpriv --reuid="$u" --regid="$u" --init-groups -- "$@" & }

pg()  { run_as postgres psql -h "$PG_SOCKET" -v ON_ERROR_STOP=1 -qAt "$@"; }

# Minimal HTTP probe (no curl in the image): succeeds when GET host:port/path returns 200.
http_ok() {
  exec 3<>"/dev/tcp/$1/$2" || return 1
  printf 'GET %s HTTP/1.0\r\nHost: %s\r\n\r\n' "$3" "$1" >&3
  local status; read -r _ status _ <&3; exec 3<&- 3>&-
  [ "$status" = 200 ]
}

wait_for() { # name, command...
  local name=$1; shift
  for _ in $(seq 1 120); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  fail "$name did not become ready in 120s"
}

# ── Storage safety ────────────────────────────────────────────────────────────

# Refuse to keep data inside the container's writable layer: it disappears when the
# container is recreated (every upgrade). /data must be a named volume or a bind mount.
require_persistent_data() {
  if ! mountpoint -q "$DATA" && [ "${HUMORA_ALLOW_EPHEMERAL:-}" != true ]; then
    fail "$DATA is not a mounted volume, so all data would be lost when this container is removed.
  Start Humora with a volume, e.g.:  -v humora-data:$DATA
  (Set HUMORA_ALLOW_EPHEMERAL=true only for throwaway test instances.)"
  fi
}

# Backups belong on a different disk from the data. Use /backups when it is mounted,
# otherwise fall back to the data volume and say so loudly.
select_backup_dir() {
  if [ -n "${BACKUP_DIR:-}" ]; then
    :
  elif mountpoint -q /backups; then
    BACKUP_DIR=/backups
  else
    BACKUP_DIR=$DATA/backups
    BACKUPS_ON_DATA_VOLUME=1
  fi
  export BACKUP_DIR
  mkdir -p "$BACKUP_DIR"/{base,dumps,files,wal}
  # PostgreSQL writes base backups, dumps and WAL itself, so it must be able to enter the directory.
  chown root:postgres "$BACKUP_DIR"; chmod 750 "$BACKUP_DIR"
  chown postgres:postgres "$BACKUP_DIR"/{base,dumps,wal}; chmod 700 "$BACKUP_DIR"/{base,dumps,wal}
}

warn_if_backups_share_disk() {
  if [ -n "${BACKUPS_ON_DATA_VOLUME:-}" ]; then
    log "WARNING: backups are stored on the data volume ($BACKUP_DIR). If that disk fails, the backups go with it."
    log "WARNING: mount a different disk or NAS at /backups, e.g.  -v /mnt/backup-disk/humora:/backups"
  fi
}

# Postgres data directories only work with the major version that created them.
check_pg_major() {
  [ -s "$PGDATA/PG_VERSION" ] || return 0
  local have; have=$(cat "$PGDATA/PG_VERSION")
  if [ "$have" != "$PG_MAJOR" ]; then
    fail "the database was created by PostgreSQL $have but this image ships PostgreSQL $PG_MAJOR.
  Nothing has been changed. Use the previous image, or restore a logical backup into this version:
    humora-entrypoint restore-dump <file in $BACKUP_DIR/dumps>"
  fi
}

# ── Environment ───────────────────────────────────────────────────────────────

prepare_dirs() {
  mkdir -p "$DATA"/{postgres,redis,minio,secrets}
  # Non-recursive: files inside are created by their owning service, and a recursive
  # chown of a large file store would slow every start.
  chown postgres:postgres "$PGDATA"; chmod 700 "$PGDATA"
  chown redis:redis "$DATA/redis"
  chown humora:humora "$DATA/minio"
  chmod 700 "$DATA/secrets"
}

SECRETS=$DATA/secrets/humora.env

# Secrets are generated once and kept on the data volume; environment variables override them.
load_secrets() {
  if [ ! -f "$SECRETS" ]; then
    log "first start: generating secrets in $SECRETS"
    (
      umask 077
      cat > "$SECRETS" <<SECRETS_EOF
JWT_SECRET=$(random_secret 48)
PASSWORD_SECRET=$(random_secret 32)
DB_PASSWORD=$(random_secret 24)
REDIS_PASSWORD=$(random_secret 24)
MINIO_ACCESS_KEY=humora$(random_secret 6)
MINIO_SECRET_KEY=$(random_secret 24)
SECRETS_EOF
    )
  fi
  local key value
  while IFS='=' read -r key value; do
    [ -n "$key" ] && [ -z "${!key:-}" ] && export "$key=$value"
  done < "$SECRETS"
  return 0
}

export_app_env() {
  HUMORA_URL=${HUMORA_URL%/}
  export ENV=production PORT=8090 LOG_LEVEL=${LOG_LEVEL:-info}
  export FRONTEND_BASE_URL=${FRONTEND_BASE_URL:-$HUMORA_URL}
  export ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-$HUMORA_URL}
  export OAUTH_REDIRECT_BASE_URL=${OAUTH_REDIRECT_BASE_URL:-$HUMORA_URL}
  export DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=humora DB_NAME=humora DB_SSLMODE=disable
  export REDIS_HOST=127.0.0.1 REDIS_PORT=6379 REDIS_DB=0
  export STORAGE_DRIVER=minio MINIO_ENDPOINT=127.0.0.1:9000 MINIO_USE_SSL=false MINIO_REGION=us-east-1
  export MINIO_DEFAULT_BUCKET=humora-media PULSE_MEDIA_BUCKET=pulse-media
  # Browsers fetch files through nginx on the public URL, so presigned URLs are signed for it.
  export MINIO_PUBLIC_URL=${MINIO_PUBLIC_URL:-$HUMORA_URL}
  # nginx runs in this container and forwards the client IP.
  export PROXY_HEADER=X-Forwarded-For TRUSTED_PROXIES=127.0.0.1
}

# ── PostgreSQL ────────────────────────────────────────────────────────────────

init_cluster() {
  log "initialising PostgreSQL (data checksums on)"
  run_as postgres initdb -D "$PGDATA" -U postgres --auth-local=peer --auth-host=scram-sha-256 \
    --encoding=UTF8 --locale=C.UTF-8 --data-checksums >/dev/null
}

# Durability settings: every committed transaction is fsynced, and every WAL segment is copied to
# the backup disk within a minute, so the database can be rebuilt to any point in time.
start_postgres() {
  spawn_as postgres postgres -D "$PGDATA" \
    -c listen_addresses=127.0.0.1 \
    -c unix_socket_directories="$PG_SOCKET" \
    -c fsync=on -c synchronous_commit=on -c full_page_writes=on \
    -c wal_level=replica \
    -c archive_mode=on \
    -c archive_command="humora-archive-wal %p %f $BACKUP_DIR/wal" \
    -c archive_timeout=60 \
    -c wal_recycle=off \
    -c max_wal_size=1GB
  PG_PID=$!
  wait_for postgres run_as postgres pg_isready -h "$PG_SOCKET"
}

stop_postgres() {
  run_as postgres pg_ctl -D "$PGDATA" stop -m fast -t 120 >/dev/null 2>&1 || true
}

create_app_database() {
  pg -d postgres <<SQL
CREATE ROLE humora LOGIN PASSWORD '$DB_PASSWORD';
CREATE DATABASE humora OWNER humora;
SQL
}
