#!/usr/bin/env bash
# Humora backups. Layout under $BACKUP_DIR:
#   base/<ts>/        physical base backup (base.tar.gz, pg_wal.tar.gz), START_WAL, humora.env
#   wal/              every WAL segment since the oldest base backup (point-in-time recovery)
#   dumps/<label>-<ts>.dump (+ .env)   logical pg_dump, test-restored before it is kept
#   files/<ts>/       snapshot of uploaded files (unchanged files are hard links to the previous one)
#
#   humora-backup run            full backup now (base + dump + files), then apply retention
#   humora-backup dump <label>   logical dump only (used before migrations)
#   humora-backup schedule       loop: daily at BACKUP_TIME (UTC), retrying hourly after a failure
#   humora-backup status         what is backed up and the restorable time range
set -Eeuo pipefail
# shellcheck source=lib.sh
. /usr/local/lib/humora/lib.sh

: "${BACKUP_DIR:?BACKUP_DIR must be set}"
KEEP=${BACKUP_KEEP:-7}
KEEP_PRE_MIGRATE=${BACKUP_KEEP_PRE_MIGRATE:-5}
VERIFY=${BACKUP_VERIFY:-restore}
STATE=$BACKUP_DIR/.state
mkdir -p "$STATE"

# Flushes everything written for a backup to disk, then publishes it by dropping the .partial suffix.
finish() { # kind, path
  sync -f "$2"
  mv "$2" "${2%.partial}"
  sync "$(dirname "$2")"
}

check_space() {
  local need avail
  need=$(pg -d postgres -c "SELECT pg_database_size('humora')")
  avail=$(df -PB1 "$BACKUP_DIR" | awk 'NR==2 {print $4}')
  # Room for a base backup and a dump of the whole database, plus headroom for WAL.
  if [ "$avail" -lt $(( need * 2 + 512 * 1024 * 1024 )) ]; then
    fail "not enough space in $BACKUP_DIR: $((avail / 1048576)) MB free, need about $(( (need * 2) / 1048576 + 512 )) MB"
  fi
}

base_backup() {
  local ts=$1 part=$BACKUP_DIR/base/$1.partial start_wal
  # The base backup starts at or after this segment, so WAL older than it is never needed by it.
  start_wal=$(pg -d postgres -c "SELECT pg_walfile_name(pg_current_wal_lsn())")
  run_as postgres pg_basebackup -h "$PG_SOCKET" -U postgres -D "$part" \
    --format=tar --gzip --wal-method=stream --checkpoint=fast --manifest-checksums=SHA256
  for t in "$part"/*.tar.gz; do gzip -t "$t"; done
  echo "$start_wal" > "$part/START_WAL"
  install -m 600 "$SECRETS" "$part/humora.env"
  finish base "$part"
  log "backup: base backup $ts complete ($(du -sh "$BACKUP_DIR/base/$ts" | cut -f1))"
}

# Restores the dump into a scratch database and compares it with the live one, so a backup is
# only kept if it is known to restore.
verify_dump() {
  local file=$1
  run_as postgres pg_restore -l "$file" >/dev/null
  [ "$VERIFY" = restore ] || return 0
  pg -d postgres -c "DROP DATABASE IF EXISTS humora_verify"
  pg -d postgres -c "CREATE DATABASE humora_verify OWNER humora"
  local ok=1
  run_as postgres pg_restore -h "$PG_SOCKET" -d humora_verify --no-owner --role=humora --exit-on-error "$file" || ok=0
  if [ $ok = 1 ]; then
    local q="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
    local live restored
    live=$(pg -d humora -c "$q"); restored=$(pg -d humora_verify -c "$q")
    [ "$live" = "$restored" ] || { log "backup: verify mismatch: $live tables live, $restored restored"; ok=0; }
  fi
  pg -d postgres -c "DROP DATABASE IF EXISTS humora_verify"
  [ $ok = 1 ] || fail "backup: dump $file failed its restore test and was discarded"
}

dump() {
  local label=$1 ts=$2
  local part=$BACKUP_DIR/dumps/$label-$ts.dump.partial
  run_as postgres pg_dump -h "$PG_SOCKET" -d humora --format=custom --compress=6 -f "$part"
  verify_dump "$part"
  install -m 600 "$SECRETS" "$BACKUP_DIR/dumps/$label-$ts.env"
  finish dump "$part"
  log "backup: $label dump $ts complete and verified ($(du -sh "$BACKUP_DIR/dumps/$label-$ts.dump" | cut -f1))"
}

files_snapshot() {
  local ts=$1 part=$BACKUP_DIR/files/$1.partial prev
  prev=$(ls -1d "$BACKUP_DIR"/files/*/ 2>/dev/null | grep -v '\.partial/$' | sort | tail -1 || true)
  rsync -a --delete ${prev:+--link-dest="$prev"} "$DATA/minio/" "$part/"
  finish files "$part"
  log "backup: file snapshot $ts complete"
}

# Keeps the newest $2 entries matching glob $1 (directories or files) and deletes the rest.
prune() {
  local keep=$2 old
  # `|| true`: an empty match is normal, and must not trip `set -o pipefail`.
  { ls -1d $1 2>/dev/null | grep -v '\.partial' | sort | head -n -"$keep" || true; } | while read -r old; do
    log "backup: removing old $(basename "$old")"
    rm -rf "$old" "${old%.dump}.env"
  done
}

retention() {
  prune "$BACKUP_DIR/base/*" "$KEEP"
  prune "$BACKUP_DIR/files/*" "$KEEP"
  prune "$BACKUP_DIR/dumps/nightly-*.dump" "$KEEP"
  prune "$BACKUP_DIR/dumps/pre-migrate-*.dump" "$KEEP_PRE_MIGRATE"
  # WAL is only needed from the oldest kept base backup onward.
  local oldest
  oldest=$(ls -1d "$BACKUP_DIR"/base/*/ 2>/dev/null | grep -v '\.partial/$' | sort | head -1 || true)
  if [ -n "$oldest" ] && [ -s "$oldest/START_WAL" ]; then
    run_as postgres pg_archivecleanup -x .gz "$BACKUP_DIR/wal" "$(cat "$oldest/START_WAL")"
  fi
}

run_full() {
  exec 9>"$STATE/lock"
  flock -n 9 || { log "backup: another backup is already running"; return 0; }
  date -u +%s > "$STATE/last_attempt"
  rm -rf "$BACKUP_DIR"/*/*.partial
  check_space
  local ts; ts=$(timestamp)
  base_backup "$ts"
  dump nightly "$ts"
  files_snapshot "$ts"
  retention
  rm -f "$DATA/.need-base-backup"
  date -u +%s > "$STATE/last_success"
  log "backup: complete ($ts)"
}

schedule() {
  local at=${BACKUP_TIME:-02:00}
  log "backup: daily backups at $at UTC to $BACKUP_DIR (keeping $KEEP)"
  while true; do
    local now due last_ok last_try
    now=$(date -u +%s)
    due=$(date -u -d "today $at" +%s)
    last_ok=$(cat "$STATE/last_success" 2>/dev/null || echo 0)
    last_try=$(cat "$STATE/last_attempt" 2>/dev/null || echo 0)
    # Run when no base backup exists yet (point-in-time recovery needs one), after a restore, or when
    # today's slot has passed without a success. Failures are retried at most hourly.
    if [ -z "$(ls -A "$BACKUP_DIR/base" 2>/dev/null)" ] || [ -f "$DATA/.need-base-backup" ] \
       || { [ "$now" -ge "$due" ] && [ "$last_ok" -lt "$due" ]; }; then
      if [ $(( now - last_try )) -ge 3600 ] || [ -f "$DATA/.need-base-backup" ] || [ "$last_try" = 0 ]; then
        # A separate process, so `set -e` applies inside it (it is ignored in a `cmd || ...` context).
        "$0" run || log "backup: FAILED, will retry in an hour (see the errors above)"
      fi
    fi
    if [ "$last_ok" -gt 0 ] && [ $(( now - last_ok )) -gt $(( 26 * 3600 )) ] && [ $(( now % 3600 )) -lt 60 ]; then
      log "WARNING: the last successful backup is $(( (now - last_ok) / 3600 )) hours old"
    fi
    sleep 60
  done
}

status() {
  local last_ok; last_ok=$(cat "$STATE/last_success" 2>/dev/null || echo 0)
  echo "Backup directory:   $BACKUP_DIR $( [ -n "${BACKUPS_ON_DATA_VOLUME:-}" ] && echo '(WARNING: same disk as the data)')"
  if [ "$last_ok" -gt 0 ]; then
    echo "Last full backup:   $(date -u -d "@$last_ok" '+%Y-%m-%d %H:%M UTC')"
  else
    echo "Last full backup:   never"
  fi
  local oldest newest_wal
  oldest=$(ls -1 "$BACKUP_DIR/base" 2>/dev/null | grep -v partial | sort | head -1 || true)
  newest_wal=$(ls -1t "$BACKUP_DIR/wal" 2>/dev/null | head -1 || true)
  if [ -n "$oldest" ]; then
    echo "Restorable from:    $oldest (oldest base backup)"
    [ -n "$newest_wal" ] && echo "Restorable until:   $(date -u -r "$BACKUP_DIR/wal/$newest_wal" '+%Y-%m-%d %H:%M:%S UTC') (newest archived WAL)"
  fi
  echo; echo "Base backups:";  ls -1 "$BACKUP_DIR/base" 2>/dev/null | sed 's/^/  /'
  echo "Verified dumps:"; ls -1 "$BACKUP_DIR/dumps" 2>/dev/null | grep '\.dump$' | sed 's/^/  /'
  echo "File snapshots:"; ls -1 "$BACKUP_DIR/files" 2>/dev/null | sed 's/^/  /'
  echo "WAL segments:     $(ls -1 "$BACKUP_DIR/wal" 2>/dev/null | wc -l)"
  echo "Space used:       $(du -sh "$BACKUP_DIR" | cut -f1), free: $(df -Ph "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
}

case "${1:-}" in
  run)      run_full ;;
  dump)     exec 9>"$STATE/lock"; flock 9; check_space; dump "${2:?label}" "$(timestamp)" ;;
  schedule) schedule ;;
  status)   status ;;
  *)        echo "usage: humora-backup run|dump <label>|schedule|status" >&2; exit 2 ;;
esac
