#!/bin/sh
# Builds the Pulse end-to-end encryption core (crypto/pulse-crypto, Rust) for Android
# and installs it into app/src/main/jniLibs.
# Requires: rustup targets aarch64-linux-android armv7-linux-androideabi x86_64-linux-android,
#           `cargo install cargo-ndk`, and an Android NDK (ANDROID_NDK_HOME or the SDK's ndk/ folder).
set -e
cd "$(dirname "$0")/.."
if [ -z "$ANDROID_NDK_HOME" ]; then
  ANDROID_NDK_HOME=$(ls -d "${ANDROID_HOME:-$HOME/Library/Android/sdk}"/ndk/* | sort -V | tail -1)
  export ANDROID_NDK_HOME
fi
cd ../crypto/pulse-crypto
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 --platform 26 -o ../../android/app/src/main/jniLibs build --release
