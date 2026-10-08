#!/usr/bin/env bash
# Applies database/migrations/*.sql in filename order, each in its own transaction,
# recording applied versions so restarts and upgrades only run new files.
#
# Safety rules:
#  - If the database already has migrations this image does not know, it was upgraded by a newer
#    image: refuse to run old code against it.
#  - Before changing an existing database, take a verified logical dump (pre-migrate-<ts>.dump).
set -Eeuo pipefail

dir=${1:-/app/migrations}
psql_app() { PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -qAt "$@"; }

psql_app -c "CREATE TABLE IF NOT EXISTS humora_schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)"

known=$(ls "$dir"/*.sql | xargs -n1 basename | sed 's/\.sql$//' | sort)
applied=$(psql_app -c "SELECT version FROM humora_schema_migrations ORDER BY version")

unknown=$(comm -13 <(echo "$known") <(echo "$applied" | sed '/^$/d'))
if [ -n "$unknown" ]; then
  echo "[migrate] ERROR: the database was migrated by a newer Humora image (unknown: $(echo $unknown))." >&2
  echo "[migrate] Refusing to start an older version against it. Run the newer image again." >&2
  exit 1
fi

pending=$(comm -23 <(echo "$known") <(echo "$applied" | sed '/^$/d'))
if [ -z "$pending" ]; then
  echo "[migrate] schema is up to date"
  exit 0
fi

if [ -n "$applied" ]; then
  echo "[migrate] $(echo "$pending" | wc -l) pending migration(s); taking a safety backup first"
  humora-backup dump pre-migrate || {
    echo "[migrate] ERROR: the pre-migration backup failed, so no migration was applied." >&2
    exit 1
  }
fi

for version in $pending; do
  echo "[migrate] applying $version"
  psql_app --single-transaction -f "$dir/$version.sql" \
    -c "INSERT INTO humora_schema_migrations (version) VALUES ('$version')"
done
echo "[migrate] schema is up to date"
