#!/usr/bin/env bash
# Humora all-in-one entrypoint.
#
#   (no args)                     start PostgreSQL, Redis, MinIO, the API, nginx and the backup scheduler
#   healthcheck                   container health probe
#   backup                        take a full backup now            (docker exec humora humora-entrypoint backup)
#   backup-status                 show backups and the restorable time range
#   restore-pitr [base] [time]    rebuild the database from a base backup + WAL, optionally up to a UTC time
#   restore-dump [file]           replace the database with a verified logical dump
#   restore-files [snapshot]      replace uploaded files with a snapshot
#
# Restores run against a stopped installation, e.g.:
#   docker stop humora
#   docker run --rm -v humora-data:/data -v /mnt/backups/humora:/backups <image> restore-pitr latest "2026-10-07 14:30:00"
# They never delete anything: the current database/files are moved aside first.
set -Eeuo pipefail
# shellcheck source=lib.sh
. /usr/local/lib/humora/lib.sh

# ── Modes that run inside a live container ────────────────────────────────────

live_env() {
  select_backup_dir
  load_secrets
  export_app_env
  run_as postgres pg_isready -q -h "$PG_SOCKET" || fail "Humora is not running in this container"
}

case "${1:-serve}" in
  healthcheck)
    http_ok 127.0.0.1 8090 /readyz && http_ok 127.0.0.1 8080 /
    exit ;;
  backup)        live_env; exec humora-backup run ;;
  backup-status) select_backup_dir; exec humora-backup status ;;
esac

# ── Offline restore modes ─────────────────────────────────────────────────────

take_volume_lock() {
  exec 8>"$LOCK_FILE"
  flock -n 8 || fail "Humora is running on this data volume. Stop it first (docker stop humora), then run the restore."
}

# Converts a backup name (20261007T095636Z) to epoch seconds.
ts_epoch() { date -u -d "$(echo "$1" | sed -E 's/^([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})Z$/\1-\2-\3 \4:\5:\6/')" +%s; }

newest() { ls -1 "$1" 2>/dev/null | grep -v '\.partial' | grep -E "${2:-.}" | sort | tail -1; }

restore_secrets_from() {
  local src=$1 stamp=$2
  [ -f "$src" ] || { log "no secrets saved with this backup; keeping the current ones"; return 0; }
  if [ -f "$SECRETS" ] && ! cmp -s "$src" "$SECRETS"; then
    mv "$SECRETS" "$SECRETS.before-restore-$stamp"
    log "current secrets kept as $SECRETS.before-restore-$stamp"
  fi
  install -m 600 "$src" "$SECRETS"
}

restore_files_from() {
  local snap=$1 stamp=$2
  [ -d "$BACKUP_DIR/files/$snap" ] || fail "no file snapshot named $snap in $BACKUP_DIR/files"
  if [ -n "$(ls -A "$DATA/minio" 2>/dev/null)" ]; then
    mv "$DATA/minio" "$DATA/minio.before-restore-$stamp"
    log "current files kept in $DATA/minio.before-restore-$stamp"
  fi
  mkdir -p "$DATA/minio"
  rsync -a "$BACKUP_DIR/files/$snap/" "$DATA/minio/"
  chown -R humora:humora "$DATA/minio"
  sync -f "$DATA/minio"
  log "files restored from snapshot $snap"
}

restore_pitr() {
  local base=${1:-latest} target=${2:-} upto stamp; stamp=$(timestamp)
  if [ "$base" = latest ]; then
    if [ -n "$target" ]; then
      # The newest base backup taken before the target time.
      local t; t=$(date -u -d "$target" +%s) || fail "cannot parse time '$target' (use e.g. \"2026-10-07 14:30:00\", UTC)"
      target=$(date -u -d "@$t" '+%Y-%m-%d %H:%M:%S')
      for b in $(ls -1 "$BACKUP_DIR/base" | grep -v partial | sort -r); do
        [ "$(ts_epoch "$b")" -le "$t" ] && { base=$b; break; }
      done
      [ "$base" != latest ] || fail "no base backup is older than $target; the oldest is $(ls -1 "$BACKUP_DIR/base" | grep -v partial | sort | head -1)"
    else
      base=$(newest "$BACKUP_DIR/base")
    fi
  fi
  local src=$BACKUP_DIR/base/$base
  [ -f "$src/base.tar.gz" ] || fail "no base backup named '$base' in $BACKUP_DIR/base"
  if [ -n "$target" ]; then upto="$target UTC"; else upto="the newest archived WAL"; fi
  log "restoring base backup $base, replaying WAL up to $upto"

  if [ -n "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
    mv "$PGDATA" "$PGDATA.before-restore-$stamp"
    log "current database kept in $PGDATA.before-restore-$stamp"
  fi
  mkdir -p "$PGDATA/pg_wal"
  tar -xzf "$src/base.tar.gz" -C "$PGDATA"
  tar -xzf "$src/pg_wal.tar.gz" -C "$PGDATA/pg_wal"
  cat >> "$PGDATA/postgresql.auto.conf" <<CONF
restore_command = 'test -f $BACKUP_DIR/wal/%f.gz && gzip -dc $BACKUP_DIR/wal/%f.gz > %p'
recovery_target_action = 'promote'
${target:+recovery_target_time = '$target+00'}
CONF
  touch "$PGDATA/recovery.signal"
  chown -R postgres:postgres "$PGDATA"; chmod 700 "$PGDATA"

  restore_secrets_from "$src/humora.env" "$stamp"
  load_secrets
  # On a fresh volume, bring back the files from the same night as the base backup.
  if [ -z "$(ls -A "$DATA/minio" 2>/dev/null)" ] && [ -d "$BACKUP_DIR/files/$base" ]; then
    restore_files_from "$base" "$stamp"
  fi

  start_postgres
  log "replaying WAL (this can take a while for large databases)"
  until [ "$(pg -d postgres -c 'SELECT pg_is_in_recovery()' 2>/dev/null)" = f ]; do
    kill -0 "$PG_PID" 2>/dev/null || fail "PostgreSQL stopped during recovery (see its log above). If the target time is later than the newest archived WAL, choose an earlier time or omit it.
  The previous database is untouched in $PGDATA.before-restore-$stamp"
    sleep 2
  done
  pg -d postgres -c "ALTER SYSTEM RESET restore_command" -c "ALTER SYSTEM RESET recovery_target_action" \
     -c "ALTER SYSTEM RESET recovery_target_time"
  log "database recovered up to $upto"
  stop_postgres
  touch "$DATA/.need-base-backup"
}

restore_dump() {
  local file=${1:-latest} stamp; stamp=$(timestamp)
  [ "$file" = latest ] && file=$(newest "$BACKUP_DIR/dumps" '\.dump$')
  [ -f "$file" ] || file=$BACKUP_DIR/dumps/$file
  [ -f "$file" ] || fail "dump not found: $file"
  log "restoring logical dump $(basename "$file")"

  local fresh=
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    fresh=1
    restore_secrets_from "${file%.dump}.env" "$stamp"
  fi
  load_secrets
  [ -n "$fresh" ] && init_cluster
  check_pg_major
  start_postgres

  local old
  old=humora_before_restore_$(echo "$stamp" | tr 'A-Z' 'a-z')
  if [ -n "$fresh" ]; then
    create_app_database
  else
    pg -d postgres -c "ALTER DATABASE humora RENAME TO $old" -c "CREATE DATABASE humora OWNER humora"
  fi
  if ! run_as postgres pg_restore -h "$PG_SOCKET" -d humora --no-owner --role=humora \
       --exit-on-error --single-transaction "$file"; then
    if [ -z "$fresh" ]; then
      pg -d postgres -c "DROP DATABASE humora" -c "ALTER DATABASE $old RENAME TO humora"
      stop_postgres
      fail "restore failed; the original database was put back unchanged"
    fi
    stop_postgres
    fail "restore failed"
  fi
  [ -z "$fresh" ] && log "previous database kept as '$old' (drop it once you are satisfied: DROP DATABASE $old)"
  stop_postgres
  touch "$DATA/.need-base-backup"
  log "database restored from $(basename "$file")"
}

case "${1:-serve}" in
  restore-pitr|restore-dump|restore-files)
    mode=$1; shift
    require_persistent_data
    prepare_dirs
    select_backup_dir
    take_volume_lock
    case $mode in
      restore-pitr)  restore_pitr "$@" ;;
      restore-dump)  restore_dump "$@" ;;
      restore-files) snap=${1:-$(newest "$BACKUP_DIR/files")}; restore_files_from "$snap" "$(timestamp)" ;;
    esac
    log "restore complete. Start Humora normally; it takes a fresh backup right away."
    exit 0 ;;
  serve) ;;
  *) fail "unknown command '$1'" ;;
esac

# ── Serve ─────────────────────────────────────────────────────────────────────

require_persistent_data
prepare_dirs
select_backup_dir
exec 8>"$LOCK_FILE"
flock -n 8 || fail "another Humora container is already using this data volume; running two at once would corrupt the database"
warn_if_backups_share_disk
load_secrets
export_app_env
check_pg_major

pids=()
shutdown() {
  log "stopping"
  [ -n "${BACKUP_PID:-}" ] && kill -TERM "$BACKUP_PID" 2>/dev/null || true
  nginx -s quit 2>/dev/null || true
  [ -n "${API_PID:-}" ] && kill -TERM "$API_PID" 2>/dev/null && wait "$API_PID" 2>/dev/null || true
  [ -n "${MINIO_PID:-}" ] && kill -TERM "$MINIO_PID" 2>/dev/null || true
  [ -n "${REDIS_PID:-}" ] && kill -TERM "$REDIS_PID" 2>/dev/null || true
  stop_postgres
  wait 2>/dev/null || true
  log "stopped"
}
trap 'shutdown; exit 0' TERM INT

# ── PostgreSQL ──
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  init_cluster
  NEW_DATABASE=1
fi
start_postgres; pids+=("$PG_PID")
[ -n "${NEW_DATABASE:-}" ] && create_app_database
humora-migrate

# ── Redis (cache, rate limits) ──
spawn_as redis redis-server --bind 127.0.0.1 --port 6379 --dir "$DATA/redis" --appendonly yes \
  --requirepass "$REDIS_PASSWORD" --save 300 10 --loglevel warning
REDIS_PID=$!; pids+=("$REDIS_PID")
wait_for redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping

# ── MinIO (files, encrypted chat media) ──
MINIO_ROOT_USER=$MINIO_ACCESS_KEY MINIO_ROOT_PASSWORD=$MINIO_SECRET_KEY MINIO_BROWSER=off \
  spawn_as humora minio server "$DATA/minio" --address 127.0.0.1:9000 --quiet
MINIO_PID=$!; pids+=("$MINIO_PID")
wait_for minio http_ok 127.0.0.1 9000 /minio/health/live

# ── API server ──
cd /app
spawn_as humora /app/server
API_PID=$!; pids+=("$API_PID")
wait_for api http_ok 127.0.0.1 8090 /readyz

# ── Web + reverse proxy ──
write_realip_conf /etc/nginx/humora-realip.conf
nginx -g 'daemon off;' &
pids+=("$!")

# ── Backups ──
humora-backup schedule &
BACKUP_PID=$!; pids+=("$BACKUP_PID")

log "Humora ${HUMORA_VERSION:-} is ready at $HUMORA_URL"
[ -n "${NEW_DATABASE:-}" ] && log "open $HUMORA_URL and choose 'Register Organization' to create the first admin account"

# Any service exiting is fatal: stop the rest and let Docker's restart policy recover.
set +e
wait -n "${pids[@]}"
status=$?
log "a service exited unexpectedly (status $status)"
shutdown
exit 1
