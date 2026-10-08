#!/bin/sh
# Builds the browser package into ./pkg and installs it into the web app.
# Requires: rustup target add wasm32-unknown-unknown; cargo install wasm-bindgen-cli --version 0.2.129
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir pkg target/wasm32-unknown-unknown/release/pulse_crypto.wasm
mkdir -p ../../web/src/pulse/wasm
cp pkg/pulse_crypto.js pkg/pulse_crypto.d.ts pkg/pulse_crypto_bg.wasm pkg/pulse_crypto_bg.wasm.d.ts ../../web/src/pulse/wasm/
