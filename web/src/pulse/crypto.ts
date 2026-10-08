import init from './wasm/pulse_crypto.js';

let ready: Promise<unknown> | null = null;

/**
 * Loads the encryption core (WebAssembly). Must resolve before a PulseClient
 * is started. In the browser pass the asset URL:
 *   import wasmUrl from './wasm/pulse_crypto_bg.wasm?url';
 *   await initPulseCrypto(wasmUrl);
 */
export function initPulseCrypto(source: string | URL | BufferSource): Promise<unknown> {
  ready ??= init({ module_or_path: source });
  return ready;
}
