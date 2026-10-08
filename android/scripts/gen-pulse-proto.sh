#!/bin/sh
# Regenerates the Pulse wire-protocol classes (protobuf-javalite) from proto/pulse/v1/pulse.proto.
# Requires protoc on PATH; its version must not be newer than the protobuf-javalite runtime in libs.versions.toml.
set -e
cd "$(dirname "$0")/.."
out=app/src/main/java
rm -rf "$out/com/paylogic/humora/pulse/v1"
protoc --java_out=lite:"$out" -I ../proto/pulse/v1 pulse.proto
