// Runs the WebAssembly build the way the browser client will use it.
//   ./build-wasm.sh && bun tests/wasm_smoke.mjs
import { readFile } from 'node:fs/promises';
import init, { PulseDevice } from '../pkg/pulse_crypto.js';

await init({ module_or_path: await readFile(new URL('../pkg/pulse_crypto_bg.wasm', import.meta.url)) });

const enc = new TextEncoder();
const dec = new TextDecoder();
const assert = (cond, msg) => { if (!cond) throw new Error(`FAILED: ${msg}`); };
const group = enc.encode('conversation-0001');

const alice = new PulseDevice(enc.encode('alice-web'));
let bob = new PulseDevice(enc.encode('bob-web'));

alice.createGroup(group);
const added = alice.addMembers(group, [bob.keyPackage()]);
alice.mergePending(group);
bob.join(added.welcome);
assert(alice.currentEpoch(group) === bob.currentEpoch(group), 'epochs match after join');

const frame = alice.encrypt(group, enc.encode('hello from wasm'));
const senderKey = bob.memberKey(group, PulseDevice.frameSender(frame));
assert(senderKey, 'sender is a group member');
const opened = bob.decrypt(group, frame, senderKey);
assert(dec.decode(opened.plaintext) === 'hello from wasm', 'bob decrypts alice');
assert(dec.decode(opened.sender) === 'alice-web', 'sender identity');

// Reload from exported state, as after a page refresh.
const state = bob.exportState();
bob = PulseDevice.restore(state);
const reply = bob.encrypt(group, enc.encode('still here after reload'));
assert(dec.decode(alice.decrypt(group, reply, bob.identityKey()).plaintext) === 'still here after reload', 'alice decrypts bob after reload');

let rejected = false;
try { alice.decrypt(group, reply, alice.identityKey()); } catch { rejected = true; }
assert(rejected, 'wrong signer key is rejected');

const n = 2000;
const body = enc.encode('x'.repeat(200));
let t = performance.now();
const frames = [];
for (let i = 0; i < n; i++) frames.push(alice.encrypt(group, body));
const encMs = (performance.now() - t) / n;
t = performance.now();
for (const f of frames) bob.decrypt(group, f, alice.identityKey());
const decMs = (performance.now() - t) / n;

console.log(`ok  state=${state.length} bytes  frame overhead=${frames[0].length - body.length} bytes`);
console.log(`encrypt+sign ${encMs.toFixed(3)} ms/msg   verify+decrypt ${decMs.toFixed(3)} ms/msg`);
