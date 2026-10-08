// Interop test: the web Pulse client ("Bob") chatting with a person using the Android app ("Alice").
//
// Start it, then on the Android device sign in as Alice, open Pulse, start a chat with Bob and send
// "hello from android". The script answers, reacts, sends an encrypted image, marks everything read,
// and reports what it receives from the phone (edits, deletes, attachments, read receipts).
//
//   PULSE_E2E_BASE        e.g. http://192.168.1.17:18080
//   PULSE_E2E_JWT_SECRET  the server's JWT_SECRET
//   PULSE_E2E_TENANT      the tenant id
//   PULSE_E2E_BOB         Bob's user id (Alice must be in the same tenant)
// Run: bun tests/android-interop.e2e.ts
import { readFile } from 'node:fs/promises';
import { initPulseCrypto, MediaKind, MemoryStorage, PulseClient, type PulseHttp } from '../src/pulse';

const BASE = process.env.PULSE_E2E_BASE!;
const SECRET = process.env.PULSE_E2E_JWT_SECRET!;
const TENANT = process.env.PULSE_E2E_TENANT!;
const BOB = process.env.PULSE_E2E_BOB!;
const TIMEOUT_MS = Number(process.env.PULSE_E2E_TIMEOUT_MS ?? 600_000);

const b64url = (data: Uint8Array | string) => Buffer.from(data).toString('base64url');

async function jwt(userId: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    user_id: userId, tenant_id: TENANT, email: 'bob@interop.test', role: 'employee', perms: [],
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

async function waitFor<T>(what: string, probe: () => T | Promise<T>, timeoutMs = TIMEOUT_MS): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value as NonNullable<T>;
    if (Date.now() > deadline) throw new Error(`timed out waiting for: ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

let step = 0;
const ok = (msg: string) => console.log(`  ok ${++step}. ${msg}`);

await initPulseCrypto(await readFile(new URL('../src/pulse/wasm/pulse_crypto_bg.wasm', import.meta.url)));
const bob = new PulseClient({
  userId: BOB,
  http: http(await jwt(BOB)),
  storage: new MemoryStorage(),
  wsUrl: (ticket) => `${BASE.replace('http', 'ws')}/api/v1/pulse/ws?ticket=${ticket}`,
  deviceName: 'Interop test (web)',
});
await bob.start();
await waitFor('connect', () => bob.connected, 15_000);
ok(`Bob's web device ${bob.deviceId} is registered and connected`);
console.log('  -> now, on Android: sign in as Alice, open Pulse, start a chat with Bob, send "hello from android"');

// 1. Alice's first message arrives and decrypts.
const first = await waitFor('"hello from android"', async () => {
  for (const c of bob.conversations()) {
    const m = (await bob.messages(c.id)).find((x) => x.text === 'hello from android');
    if (m) return { conv: c.id, msg: m };
  }
  return undefined;
});
const conv = bob.conversation(first.conv)!;
ok(`received "${first.msg.text}" from the Android app (conversation kind=${conv.kind}, epoch=${conv.epoch})`);

// 2. Reply, react, send an encrypted image, mark read.
const reply = await bob.sendText(first.conv, 'hello from web 👋', { replyToId: first.msg.id });
await bob.react(first.conv, first.msg.id, '👍');
// A valid 16x16 gradient PNG (also used as its own inline thumbnail).
const png = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAABlklEQVR4nA3L0QBAIQxA0RCGEMIQhjCEEIYwhBBC2McFCCGEEEJ47/yf1hrS6A1tWMMboxGNbMzGalRjN07jNl6jNUGELqhgggtDCCGFKSyhhC0c4QpP/tCRTu9oxzreGZ3oZGd2Vqc6u3M6t/P6HxRRuqKKKa4MJZRUprKUUrZylKs8/YMhRjfUMMONYYSRxjSWUcY2jnGNZ39wxOmOOua4M5xw0pnOcsrZznGu8/wPAxn0gQ5s4IMxiEEO5mANarAHZ3AHb/whkKAHGljgwQgiyGAGK6hgBye4wYs/JJL0RBNLPBlJJJnMZCWV7OQkN3n5h4lM+kQnNvHJmMQkJ3OyJjXZkzO5kzf/sJBFX+jCFr4Yi1jkYi7WohZ7cRZ38dYfCil6oYUVXowiiixmsYoqdnGKW7z6w0Y2faMb2/hmbGKTm7lZm9rszdnczdt/OMihH/RgBz+MQxzyMA/rUId9OId7eOcPF7n0i17s4pdxiUte5mVd6rIv53Iv7/7hIY/+0Ic9/DEe8cjHfKxHPfbjPO7jPT74o6QQdaP0PQAAAABJRU5ErkJggg==', 'base64'));
const image = await bob.sendMedia(first.conv, new Blob([png], { type: 'image/png' }), {
  kind: MediaKind.IMAGE, fileName: 'from-web.png', mimeType: 'image/png', width: 16, height: 16, thumbnail: png, caption: 'an encrypted picture',
});
await bob.markRead(first.conv);
await bob.idle();
ok('replied, reacted 👍, sent an encrypted image and marked the chat read');

// 3. The phone acknowledges: Bob's messages reach "read" (the app is open on the chat).
await waitFor('Alice to read Bob\'s reply', async () => {
  const m = (await bob.messages(first.conv)).find((x) => x.id === image);
  return m && bob.tick(m) === 'read';
});
ok('Android delivered and read receipts arrived (blue ticks on Bob\'s messages)');

// 4. Whatever else the phone does: report edits, deletes, reactions, attachments, new messages.
console.log('  -> on Android: react to Bob\'s message, edit or delete one of yours, send a photo or voice note.');
console.log('     Ctrl+C to stop. Watching for 5 minutes…');
const seen = new Map<string, string>();
const deadline = Date.now() + 300_000;
while (Date.now() < deadline) {
  for (const m of await bob.messages(first.conv)) {
    const reactions = Object.entries(m.reactions).map(([u, e]) => `${u === BOB ? 'bob' : 'alice'}:${e}`).join(',');
    const state = `${m.text}|${m.edited}|${m.deleted}|${m.media?.fileName ?? ''}|${reactions}|${m.unavailable}`;
    if (seen.get(m.id) === state) continue;
    seen.set(m.id, state);
    if (m.senderId === BOB && m.id !== reply && m.id !== image) continue;
    const who = m.senderId === BOB ? 'bob' : 'alice';
    let line = `  [${who}] ${m.deleted ? '<deleted>' : m.unavailable ? '<unavailable>' : JSON.stringify(m.text)}`;
    if (m.edited) line += ' (edited)';
    if (m.media) {
      const blob = await bob.loadMedia(m).catch((e) => e as Error);
      line += blob instanceof Blob ? ` [attachment ${m.media.fileName}, ${blob.size} bytes, decrypted OK]` : ` [attachment FAILED: ${blob.message}]`;
    }
    if (reactions) line += ` reactions=${reactions}`;
    console.log(line);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
bob.stop();
