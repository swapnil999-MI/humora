// End-to-end test of the Pulse client against a real backend.
//
// Needs a running server on a database with the Pulse schema and no Pulse
// data from an earlier run (every run registers brand-new devices), plus:
//   PULSE_E2E_BASE        e.g. http://127.0.0.1:18090
//   PULSE_E2E_JWT_SECRET  the server's JWT_SECRET
//   PULSE_E2E_TENANT      a tenant id
//   PULSE_E2E_USERS       four user ids in that tenant, comma separated
// Run: bun tests/pulse.e2e.ts
import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { IndexedDbStorage, initPulseCrypto, MediaKind, MemoryStorage, PulseClient, TagType, type PulseHttp, type PulseStorage } from '../src/pulse';

const BASE = process.env.PULSE_E2E_BASE!;
const SECRET = process.env.PULSE_E2E_JWT_SECRET!;
const TENANT = process.env.PULSE_E2E_TENANT!;
const [ALICE, BOB, CAROL, DAVE] = process.env.PULSE_E2E_USERS!.split(',');

const b64url = (data: Uint8Array | string) => Buffer.from(data).toString('base64url');

async function jwt(userId: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    user_id: userId, tenant_id: TENANT, email: `${userId}@pulse.test`, role: 'employee', perms: [],
    // The server only accepts access tokens issued by humora-auth for the humora-access audience.
    iss: 'humora-auth', aud: ['humora-access'],
    exp: Math.floor(Date.now() / 1000) + 3600,
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

const clients: PulseClient[] = [];
async function client(userId: string, storage: PulseStorage = new MemoryStorage()): Promise<PulseClient> {
  const c = new PulseClient({
    userId,
    http: http(await jwt(userId)),
    storage,
    wsUrl: (ticket) => `${BASE.replace('http', 'ws')}/api/v1/pulse/ws?ticket=${ticket}`,
  });
  clients.push(c);
  await c.start();
  await waitFor('connect', () => c.connected);
  await c.idle();
  return c;
}

async function waitFor<T>(what: string, probe: () => T | Promise<T>, timeoutMs = 8000): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value as NonNullable<T>;
    if (Date.now() > deadline) throw new Error(`timed out waiting for: ${what}`);
    await new Promise((r) => setTimeout(r, 15));
  }
}

const texts = async (c: PulseClient, conv: string) => (await c.messages(conv)).map((m) => (m.unavailable ? '<unavailable>' : m.text));
const find = async (c: PulseClient, conv: string, id: string) => (await c.messages(conv)).find((m) => m.id === id);
const has = (c: PulseClient, conv: string, text: string) => async () => (await texts(c, conv)).includes(text);

let step = 0;
const ok = (msg: string) => console.log(`  ok ${++step}. ${msg}`);
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAILED: ${msg}`);
}

await initPulseCrypto(await readFile(new URL('../src/pulse/wasm/pulse_crypto_bg.wasm', import.meta.url)));

// ── 1. DM: send, deliver, read ────────────────────────────────────────
const alice = await client(ALICE);
// Bob runs on the browser storage implementation; the others in memory.
const bobStorage = await IndexedDbStorage.open(BOB);
let bob = await client(BOB, bobStorage);

const dm = (await alice.createConversation('dm', [BOB])).id;
const hello = await alice.sendText(dm, 'hello bob');
assert((await find(alice, dm, hello))?.text === 'hello bob', 'sender sees own message immediately');
await waitFor('bob receives', has(bob, dm, 'hello bob'));
ok('bob decrypts a message from alice');

await waitFor('double tick', async () => alice.tick((await find(alice, dm, hello))!) === 'delivered');
ok('alice sees a double tick once bob has it');
assert((await bob.unreadCount(dm)) === 1, `bob unread = ${await bob.unreadCount(dm)}, want 1`);
await bob.markRead(dm);
await waitFor('blue tick', async () => alice.tick((await find(alice, dm, hello))!) === 'read');
assert((await bob.unreadCount(dm)) === 0, 'bob unread cleared');
ok('alice sees blue ticks once bob reads it');

// ── 2. Reactions, replies with tags, edit, delete ─────────────────────
await bob.react(dm, hello, '👍');
await waitFor('reaction', async () => (await find(alice, dm, hello))?.reactions[BOB] === '👍');
await bob.react(dm, hello, '');
await waitFor('reaction removed', async () => (await find(alice, dm, hello))?.reactions[BOB] === undefined);
ok('reactions are added and removed');

const taskId = crypto.randomUUID();
const reply = await bob.sendText(dm, 'see PAY-101', { replyToId: hello, tags: [{ type: TagType.TASK, id: taskId, offset: 4, length: 7, title: 'PAY-101' }] });
const got = await waitFor('reply', () => find(alice, dm, reply));
assert(got.replyToId === hello && got.tags[0]?.id === taskId && got.tags[0]?.type === TagType.TASK, 'reply and tag round-trip');
ok('replies and element tags travel inside the encrypted message');

await bob.editMessage(dm, reply, 'see PAY-102');
await waitFor('edit', async () => (await find(alice, dm, reply))?.text === 'see PAY-102' && (await find(alice, dm, reply))?.edited);
await alice.editMessage(dm, reply, 'hijacked');
await alice.deleteMessage(dm, hello);
await waitFor('delete', async () => (await find(bob, dm, hello))?.deleted);
assert((await find(bob, dm, reply))?.text === 'see PAY-102', "alice cannot edit bob's message");
ok('edit and delete work, and only for the author');

// ── 3. Offline: messages wait on the server, state survives a restart ─
bob.stop();
const offline = [await alice.sendText(dm, 'while you were away 1'), await alice.sendText(dm, 'while you were away 2')];
await waitFor('single tick', async () => alice.tick((await find(alice, dm, offline[1]))!) === 'sent');
ok('messages to an offline user stay at a single tick');
bob = await client(BOB, bobStorage);
await waitFor('offline delivery', has(bob, dm, 'while you were away 2'));
await waitFor('ticks catch up', async () => alice.tick((await find(alice, dm, offline[1]))!) === 'delivered');
ok('the restarted device restores its keys and receives what it missed');

// ── 4. A recipient who has never opened Pulse ─────────────────────────
const dm2 = (await alice.createConversation('dm', [CAROL])).id;
const early = await alice.sendText(dm2, 'sent before carol had a device');
await waitFor('stored', async () => (await find(alice, dm2, early))?.status === 'sent');
const carol = await client(CAROL);
await waitFor('carol reads early message', has(carol, dm2, 'sent before carol had a device'));
ok('a user who registers later is added and can read what was sent before');

// ── 5. Group, then a second device for an existing member ─────────────
const group = (await alice.createConversation('group', [BOB, CAROL], 'Payroll sprint')).id;
await alice.sendText(group, 'group hello');
await waitFor('bob in group', has(bob, group, 'group hello'));
await waitFor('carol in group', has(carol, group, 'group hello'));
await carol.sendText(group, 'carol here');
await waitFor('alice hears carol', has(alice, group, 'carol here'));
await waitFor('bob hears carol', has(bob, group, 'carol here'));
ok('three members exchange messages in a group');

const bobPhone = await client(BOB);
await waitFor('new device history', async () => {
  const t = await texts(bobPhone, group);
  return t.includes('group hello') && t.includes('carol here');
});
await waitFor('new device dm history', has(bobPhone, dm, 'while you were away 2'));
await bobPhone.sendText(group, 'from my phone');
await waitFor('alice hears phone', has(alice, group, 'from my phone'));
await waitFor('bob laptop hears phone', has(bob, group, 'from my phone'));
ok("a member's new device is added and reads earlier history");

// ── Encrypted attachments (needs object storage on the server) ────────
if (process.env.PULSE_E2E_MEDIA) {
  const original = crypto.getRandomValues(new Uint8Array(300_000));
  const marker = new TextEncoder().encode('PLAINTEXT-MARKER-IN-FILE');
  original.set(marker, 1000);
  const fileId = await alice.sendMedia(dm, new Blob([original], { type: 'application/pdf' }), {
    kind: MediaKind.DOCUMENT, fileName: 'payslip.pdf', mimeType: 'application/pdf', caption: 'your payslip',
  });
  const received = await waitFor('media message', async () => {
    const m = await find(bob, dm, fileId);
    return m?.media ? m : undefined;
  });
  assert(received.text === 'your payslip' && received.media!.fileName === 'payslip.pdf' && received.media!.sizeBytes === original.length, 'media metadata');
  const opened = new Uint8Array(await (await bob.loadMedia(received)).arrayBuffer());
  assert(opened.length === original.length && opened.every((b, i) => b === original[i]), 'bob decrypts the exact file');

  // What sits in object storage is unreadable, and a tampered copy is refused.
  const link = await http(await jwt(BOB)).post<{ url: string }>('/pulse/media/download-url', { conversation_id: dm, object_key: received.media!.objectKey });
  const stored = Buffer.from(await (await fetch(link.url)).arrayBuffer());
  assert(!stored.includes(Buffer.from(marker)), 'stored blob must not contain the plaintext');
  let refused = false;
  try {
    await carol.loadMedia(received);
  } catch {
    refused = true;
  }
  assert(refused, 'a non-member cannot fetch the attachment');
  ok('files are encrypted before upload and only members can open them');
}

// ── 6. Outsiders ──────────────────────────────────────────────────────
const dave = await client(DAVE);
assert(dave.conversations().length === 0, 'dave sees no conversations');
await dave.sendText(group, 'let me in');
await new Promise((r) => setTimeout(r, 300));
assert(!(await texts(alice, group)).includes('let me in'), 'outsider message never arrives');
ok('a non-member cannot post into a conversation');

// ── 7. Latency on this machine, including encryption on both sides ────
const samples: number[] = [];
for (let i = 0; i < 40; i++) {
  const text = `latency ${i}`;
  const start = performance.now();
  await alice.sendText(dm, text);
  await waitFor('latency', has(bob, dm, text));
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(`  send -> shown on the other device: p50=${samples[20].toFixed(1)}ms p95=${samples[37].toFixed(1)}ms (15ms poll granularity)`);

// ── 8. Sending never waits for the other side to be online ────────────
// Every device but a brand-new one of Alice's is offline. It joins the
// conversation's encryption on its own and sends straight away.
alice.stop();
bob.stop();
bobPhone.stop();
const tabletStorage = new MemoryStorage();
let aliceTablet = await client(ALICE, tabletStorage);
const alone = await aliceTablet.sendText(dm, 'nobody else is online');
await waitFor('single tick with everyone offline', async () => aliceTablet.tick((await find(aliceTablet, dm, alone))!) === 'sent');
ok('a new device sends at once (single tick) while every other device is offline');
bob = await client(BOB, bobStorage);
await waitFor('bob reads it', has(bob, dm, 'nobody else is online'));
await waitFor('double tick', async () => aliceTablet.tick((await find(aliceTablet, dm, alone))!) === 'delivered');
await bob.markRead(dm);
await waitFor('blue tick', async () => aliceTablet.tick((await find(aliceTablet, dm, alone))!) === 'read');
ok('it turns into two ticks when the receiver comes online, and blue once read');

// A conversation whose creator never set up its encryption: any member can start it.
const unset = await http(await jwt(ALICE)).post<{ id: string }>('/pulse/conversations', { kind: 'group', name: 'Never set up', member_ids: [BOB] });
await bob.idle();
const first = await bob.sendText(unset.id, 'starting it myself');
await waitFor('stored', async () => bob.tick((await find(bob, unset.id, first))!) === 'sent');
await waitFor('alice reads it', has(aliceTablet, unset.id, 'starting it myself'));
ok('a member can start the encryption of a conversation its creator never opened');

// ── 9. The receiver reinstalls ────────────────────────────────────────
// Carol's only device is gone. Alice's message waits at one tick; Carol's new
// device gets it, but two ticks only show once it can actually read it.
carol.stop();
bob.stop();
const forCarol = await aliceTablet.sendText(dm2, 'sent while carol reinstalls');
const sentSeq = (await waitFor('stored', async () => (await find(aliceTablet, dm2, forCarol))?.seq))!;
aliceTablet.stop(); // and the sender goes offline too
const carolNew = await client(CAROL);
await waitFor('carol has it, unreadable', async () => (await find(carolNew, dm2, forCarol))?.unavailable);
await carolNew.markRead(dm2);
await new Promise((r) => setTimeout(r, 500));
const seen = await http(await jwt(ALICE)).get<{ members: { user_id: string; delivered_seq: number; read_seq: number }[] }>(`/pulse/conversations/${dm2}`);
const carolMark = seen.members.find((m) => m.user_id === CAROL)!;
assert(carolMark.delivered_seq < sentSeq && carolMark.read_seq < sentSeq, `carol acked ${carolMark.delivered_seq}/${carolMark.read_seq} before she could read seq ${sentSeq}`);
ok('no double tick while the new device cannot read the message yet');
aliceTablet = await client(ALICE, tabletStorage);
await waitFor('carol reads it after the key arrives', has(carolNew, dm2, 'sent while carol reinstalls'), 15000);
await waitFor('double tick', async () => aliceTablet.tick((await find(aliceTablet, dm2, forCarol))!) === 'delivered');
await carolNew.markRead(dm2);
await waitFor('blue tick', async () => aliceTablet.tick((await find(aliceTablet, dm2, forCarol))!) === 'read');
ok('once the sender is back online the key is shared: two ticks, then blue once read');

for (const c of clients) c.stop();
console.log('ALL PASSED');
process.exit(0);
