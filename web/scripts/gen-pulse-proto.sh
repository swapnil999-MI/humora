#!/bin/sh
# Regenerates src/pulse/gen/pulse_pb.ts from proto/pulse/v1/pulse.proto.
# Requires protoc on PATH. The plugin is run through bun so Node is not needed.
set -e
cd "$(dirname "$0")/.."
plugin="$(mktemp)"
trap 'rm -f "$plugin"' EXIT
printf '#!/bin/sh\nexec bun "%s/node_modules/@bufbuild/protoc-gen-es/bin/protoc-gen-es" "$@"\n' "$PWD" > "$plugin"
chmod +x "$plugin"
mkdir -p src/pulse/gen
protoc --plugin=protoc-gen-es="$plugin" --es_out=src/pulse/gen --es_opt=target=ts -I ../proto/pulse/v1 pulse.proto
