#!/bin/sh
# PostgreSQL archive_command: copies one finished WAL segment to the backup disk.
#   humora-archive-wal <%p path> <%f name> <archive dir>
# Postgres only recycles a segment after this exits 0, so it must not succeed until the copy
# is durably on disk, and it must never overwrite an archived segment with different content.
set -eu

src=$1
name=$2
dir=$3
dest=$dir/$name.gz

if [ -f "$dest" ]; then
  # Re-archiving after a crash is normal; accept it only if the content is identical.
  if gzip -dc "$dest" | cmp -s - "$src"; then
    exit 0
  fi
  echo "humora-archive-wal: $dest already exists with different content; refusing to overwrite" >&2
  exit 1
fi

gzip -1 -c "$src" > "$dest.tmp"
sync "$dest.tmp"
mv "$dest.tmp" "$dest"
sync "$dir"
