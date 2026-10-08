// Measures Pulse message latency through the real client and server.
//
// For each message it records, from the moment sendText() is called:
//   echo    the sender's own screen shows it
//   stored  the server has stored it (single tick)
//   shown   the recipient's screen shows it, decrypted
//
// Needs a running server and two user ids in one tenant with no earlier Pulse data:
//   PULSE_E2E_BASE, PULSE_E2E_JWT_SECRET, PULSE_E2E_TENANT, PULSE_E2E_USERS=alice,bob
//   PULSE_LAT_STORAGE=idb to run the clients on IndexedDB (fake-indexeddb) instead of memory
// Run: bun tests/pulse.latency.ts
import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { IndexedDbStorage, initPulseCrypto, MemoryStorage, PulseClient, type PulseHttp, type PulseStorage } from '../src/pulse';

const BASE = process.env.PULSE_E2E_BASE!;
const SECRET = process.env.PULSE_E2E_JWT_SECRET!;
const TENANT = process.env.PULSE_E2E_TENANT!;
const [ALICE, BOB] = process.env.PULSE_E2E_USERS!.split(',');
const N = Number(process.env.PULSE_LAT_N ?? 100);
const IDB = process.env.PULSE_LAT_STORAGE === 'idb';

const b64url = (data: Uint8Array | string) => Buffer.from(data).toString('base64url');

async function jwt(userId: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    user_id: userId, tenant_id: TENANT, email: `${userId}@pulse.test`, role: 'employee', perms: [],
    iss: 'humora-auth', aud: ['humora-access'], exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

function http(token: string): PulseHttp {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json()) as { success: boolean; message: string; data: T };
    if (!res.ok || !json.success) throw new Error(json.message);
    return json.data;
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b) };
}

async function client(userId: string): Promise<PulseClient> {
  const storage: PulseStorage = IDB ? await IndexedDbStorage.open(userId) : new MemoryStorage();
  const c = new PulseClient({
    userId,
    http: http(await jwt(userId)),
    storage,
    wsUrl: (ticket) => `${BASE.replace('http', 'ws')}/api/v1/pulse/ws?ticket=${ticket}`,
  });
  await c.start();
  while (!c.connected) await new Promise((r) => setTimeout(r, 10));
  await c.idle();
  return c;
}

await initPulseCrypto(await readFile(new URL('../src/pulse/wasm/pulse_crypto_bg.wasm', import.meta.url)));
const alice = await client(ALICE);
const bob = await client(BOB);
const dm = (await alice.createConversation('dm', [BOB])).id;
await alice.sendText(dm, 'warm-up');
while (!(await bob.messages(dm)).some((m) => m.text === 'warm-up')) await new Promise((r) => setTimeout(r, 10));

// Event driven, like the UI: each 'messages' event makes the screen re-read the conversation.
type Probe = { text: string; start: number; echo?: number; stored?: number; shown?: number };
let current: Probe | undefined;
let done: () => void = () => {};
const check = async () => {
  const p = current;
  if (!p) return;
  const now = performance.now();
  if (p.echo === undefined && (await alice.messages(dm)).some((m) => m.text === p.text)) p.echo = now - p.start;
  if (p.stored === undefined && (await alice.messages(dm)).some((m) => m.text === p.text && m.status === 'sent')) p.stored = now - p.start;
  if (p.shown === undefined && (await bob.messages(dm)).some((m) => m.text === p.text)) p.shown = now - p.start;
  if (p.echo !== undefined && p.stored !== undefined && p.shown !== undefined) done();
};
alice.subscribe((e) => { if (e.type === 'messages') void check(); });
bob.subscribe((e) => { if (e.type === 'messages') void check(); });

const results: Probe[] = [];
for (let i = 0; i < N; i++) {
  const p: Probe = { text: `latency probe ${i} ${'x'.repeat(80)}`, start: performance.now() };
  current = p;
  const finished = new Promise<void>((r) => (done = r));
  await alice.sendText(dm, p.text);
  await Promise.race([finished, new Promise((r) => setTimeout(r, 5000))]);
  results.push(p);
  await new Promise((r) => setTimeout(r, Number(process.env.PULSE_LAT_GAP_MS ?? 20)));
}

const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * q)];
const row = (name: string, xs: number[]) =>
  console.log(`${name.padEnd(7)} p50=${pct(xs, 0.5).toFixed(2)}ms p95=${pct(xs, 0.95).toFixed(2)}ms p99=${pct(xs, 0.99).toFixed(2)}ms`);
console.log(`${N} messages, storage=${IDB ? 'indexeddb' : 'memory'}`);
row('echo', results.map((r) => r.echo ?? 5000));
row('stored', results.map((r) => r.stored ?? 5000));
row('shown', results.map((r) => r.shown ?? 5000));
alice.stop();
bob.stop();
process.exit(0);
