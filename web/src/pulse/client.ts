// PulseClient: the end-to-end encrypted messaging engine for one signed-in
// user on one device. It owns the device keys, the gateway socket, the local
// message store and the outbox, and exposes plain decrypted messages to the UI.
//
// All state changes run on a single serial queue (`run`), so frames from the
// server, user actions and background maintenance never interleave.

import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import * as pb from './gen/pulse_pb';
import { b64decode, b64encode, bytesToUuid, concat, toHex, uuidToBytes, uuidv7 } from './ids';
import { PulseSocket, PulseSocketError } from './socket';
import { pendingOrder, type LocalMessage, type PulseStorage } from './storage';
import { PulseDevice } from './wasm/pulse_crypto.js';

export interface PulseHttp {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
}

export interface PulseMember {
  user_id: string;
  role: string;
  joined_seq: number;
  delivered_seq: number;
  read_seq: number;
}

export interface PulseConversation {
  id: string;
  kind: 'dm' | 'group' | 'channel';
  name: string;
  topic: string;
  is_private: boolean;
  created_by: string;
  last_seq: number;
  epoch: number;
  last_message_at?: string;
  created_at: string;
  members: PulseMember[];
}

export type PulseEvent =
  | { type: 'connection'; connected: boolean }
  | { type: 'conversations' }
  | { type: 'messages'; conversationId: string }
  | { type: 'typing'; conversationId: string; userId: string; active: boolean };

/** pending: not on the server yet. sent: one tick. delivered: two ticks. read: blue ticks. */
export type Tick = 'pending' | 'failed' | 'sent' | 'delivered' | 'read';

export interface SendOptions {
  replyToId?: string;
  threadRootId?: string;
  tags?: { type: pb.TagType; id: string; offset?: number; length?: number; title?: string; status?: string }[];
}

export interface MediaInfo {
  kind: pb.MediaKind;
  fileName: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  /** Small inline preview (a few KB at most): it travels inside the message itself. */
  thumbnail?: Uint8Array;
  /** Voice-note loudness samples, 0-255. */
  waveform?: Uint8Array;
  caption?: string;
}

/** Largest attachment the server accepts, after encryption. */
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const MAX_INLINE_PREVIEW_BYTES = 24 * 1024;
const MEDIA_CACHE_ENTRIES = 40;

export interface PulseClientOptions {
  userId: string;
  http: PulseHttp;
  storage: PulseStorage;
  /** Builds the gateway URL for a ticket, e.g. wss://host/api/v1/pulse/ws?ticket=... */
  wsUrl: (ticket: string) => string;
  deviceName?: string;
  WebSocketImpl?: typeof WebSocket;
}

interface DeviceInfo {
  id: string;
  user_id: string;
}

interface ClaimedKeyPackage {
  device_id: string;
  key_package: string;
}

/** A membership commit in flight; persisted so a crash or timeout cannot lose track of it. */
interface PendingCommit {
  id: string;
  commit: Uint8Array;
  epoch: number;
  /** staged: not yet accepted by the server. merged: accepted; welcomes still to deliver. */
  stage: 'staged' | 'merged';
  welcome?: Uint8Array;
  welcomeTo: string[]; // device ids
}

type Directory = Map<string, DeviceInfo[]>;

const KEY_PACKAGE_BATCH = 20;
const KEY_PACKAGE_LOW_WATER = 8;
const SYNC_PAGE = 200;
const HISTORY_KEYS_PER_FRAME = 1000;

// Device-to-device payload types (first byte of a Direct payload).
const DIRECT_WELCOME = 1;
const DIRECT_HISTORY_KEYS = 2;

const isCode = (e: unknown, code: PulseSocketError['code']) => e instanceof PulseSocketError && e.code === code;
const isTransient = (e: unknown) =>
  e instanceof PulseSocketError &&
  (e.code === 'offline' || e.code === 'timeout' || e.code === pb.ErrorCode.RATE_LIMITED || e.code === pb.ErrorCode.INTERNAL);

export class PulseClient {
  readonly userId: string;
  deviceId = '';

  private opts: PulseClientOptions;
  private storage: PulseStorage;
  private http: PulseHttp;
  private device!: PulseDevice;
  private identity!: Uint8Array;
  private socket!: PulseSocket;

  private convs = new Map<string, PulseConversation>();
  private cursors = new Map<string, number>();
  private senderKeys = new Map<string, Uint8Array>();
  private refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Decrypted attachments by message id, most recently used last. */
  private mediaCache = new Map<string, Blob>();
  private listeners = new Set<(e: PulseEvent) => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private stopped = false;

  constructor(opts: PulseClientOptions) {
    this.opts = opts;
    this.userId = opts.userId;
    this.storage = opts.storage;
    this.http = opts.http;
  }

  // ───────────────────────────── Lifecycle ─────────────────────────────

  /** Loads (or creates and registers) this device, then connects. `initPulseCrypto` must have resolved first. */
  async start(): Promise<void> {
    await this.loadDevice();
    for (const c of (await this.storage.get<PulseConversation[]>('conversations')) ?? []) this.convs.set(c.id, c);

    this.socket = new PulseSocket({
      getUrl: async () => {
        const { ticket } = await this.http.post<{ ticket: string }>('/pulse/ws-ticket', { device_id: this.deviceId });
        return this.opts.wsUrl(ticket);
      },
      onOpen: () => {
        this.emit({ type: 'connection', connected: true });
        void this.run(() => this.resync());
      },
      onClose: () => this.emit({ type: 'connection', connected: false }),
      onFrame: (frame) => void this.run(() => this.handleFrame(frame)),
      WebSocketImpl: this.opts.WebSocketImpl,
    });
    this.socket.start();
  }

  stop(): void {
    this.stopped = true;
    for (const t of this.refreshTimers.values()) clearTimeout(t);
    this.refreshTimers.clear();
    this.socket?.stop();
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Resolves once everything queued so far has been processed. */
  idle(): Promise<void> {
    return this.run(async () => {});
  }

  subscribe(listener: (e: PulseEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: PulseEvent): void {
    for (const l of this.listeners) l(e);
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(task);
    this.chain = result.catch((e) => {
      if (!this.stopped && !isCode(e, 'offline')) console.error('[pulse]', e);
    });
    return result;
  }

  private async loadDevice(): Promise<void> {
    const state = await this.storage.getSecret('device');
    const id = await this.storage.get<string>('device-id');
    if (state && id) {
      this.device = PulseDevice.restore(state);
      this.deviceId = id;
      this.identity = concat(uuidToBytes(this.userId), uuidToBytes(id));
    } else {
      // The device id is part of the encryption credential, so it is chosen here.
      this.deviceId = crypto.randomUUID();
      this.identity = concat(uuidToBytes(this.userId), uuidToBytes(this.deviceId));
      this.device = new PulseDevice(this.identity);
      await this.persist();
      await this.storage.set('device-id', this.deviceId);
    }

    if (!(await this.storage.get<boolean>('device-registered'))) {
      const keyPackages = this.newKeyPackages(KEY_PACKAGE_BATCH);
      await this.persist();
      try {
        await this.http.post('/pulse/devices', {
          id: this.deviceId,
          platform: 'web',
          name: this.opts.deviceName ?? 'Web browser',
          identity_key: b64encode(this.device.identityKey()),
          key_packages: keyPackages,
        });
      } catch (e) {
        // A previous attempt got through but was interrupted before we recorded it.
        if (!(e instanceof Error && e.message.includes('already registered'))) throw e;
      }
      await this.storage.set('device-registered', true);
    }
  }

  private newKeyPackages(n: number): string[] {
    return Array.from({ length: n }, () => b64encode(this.device.keyPackage()));
  }

  /** Writes the device's key material to local storage. Called after every change to it. */
  private persist(): Promise<void> {
    return this.storage.setSecret('device', this.device.exportState());
  }

  // ───────────────────────────── Read API ─────────────────────────────

  conversations(): PulseConversation[] {
    return [...this.convs.values()].sort(
      (a, b) => Date.parse(b.last_message_at ?? b.created_at) - Date.parse(a.last_message_at ?? a.created_at),
    );
  }

  conversation(id: string): PulseConversation | undefined {
    return this.convs.get(id);
  }

  messages(conversationId: string, opts?: { beforeOrder?: number; limit?: number }): Promise<LocalMessage[]> {
    return this.storage.listMessages(conversationId, opts);
  }

  /**
   * Messages from other people after this user's read position. Counted from
   * the local store because the log also holds entries that are not messages
   * (key changes, reactions, edits). Capped at the 200 most recent.
   */
  async unreadCount(conversationId: string): Promise<number> {
    const me = this.convs.get(conversationId)?.members.find((m) => m.user_id === this.userId);
    if (!me) return 0;
    const recent = await this.storage.listMessages(conversationId, { limit: 200 });
    return recent.filter((m) => m.seq !== undefined && m.seq > me.read_seq && m.senderId !== this.userId).length;
  }

  /** Tick state of one of the user's own messages. */
  tick(message: LocalMessage): Tick {
    if (message.status !== 'sent') return message.status;
    if (message.seq === undefined) return 'sent';
    const others = this.convs.get(message.conversationId)?.members.filter((m) => m.user_id !== this.userId) ?? [];
    if (others.length === 0) return 'sent';
    if (others.every((m) => m.read_seq >= message.seq!)) return 'read';
    if (others.every((m) => m.delivered_seq >= message.seq!)) return 'delivered';
    return 'sent';
  }

  // ───────────────────────────── Write API ─────────────────────────────

  /** Creates a conversation (or returns the existing DM) and sets up its encryption. */
  async createConversation(
    kind: PulseConversation['kind'],
    memberIds: string[],
    name = '',
    topic = '',
    isPrivate = true,
  ): Promise<PulseConversation> {
    const conv = await this.http.post<PulseConversation>('/pulse/conversations', {
      kind, name, topic, is_private: isPrivate, member_ids: memberIds,
    });
    await this.run(async () => {
      this.convs.set(conv.id, conv);
      this.emit({ type: 'conversations' });
      try {
        await this.setUp([conv]);
      } catch (e) {
        if (!isTransient(e)) throw e;
        // Offline: the next resync finishes the setup.
      }
    });
    return this.convs.get(conv.id) ?? conv;
  }

  sendText(conversationId: string, text: string, opts: SendOptions = {}): Promise<string> {
    return this.submit(conversationId, { case: 'text', value: create(pb.TextSchema, { body: text }) }, opts);
  }

  /**
   * Sends a file or voice note. The file is encrypted on this device with a
   * one-off key, uploaded as an opaque blob, and the key travels inside the
   * encrypted message, so the storage server never sees the content.
   */
  async sendMedia(conversationId: string, file: Blob, info: MediaInfo, opts: SendOptions = {}): Promise<string> {
    if ((info.thumbnail?.length ?? 0) > MAX_INLINE_PREVIEW_BYTES) throw new Error('Preview image is too large');
    const key = crypto.getRandomValues(new Uint8Array(32));
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const aes = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, await file.arrayBuffer());
    if (sealed.byteLength > MAX_MEDIA_BYTES) throw new Error('File is larger than 100 MB');
    const sha256 = new Uint8Array(await crypto.subtle.digest('SHA-256', sealed));

    const slot = await this.http.post<{ object_key: string; url: string; fields: Record<string, string> }>(
      '/pulse/media/upload-url',
      { conversation_id: conversationId, size_bytes: sealed.byteLength },
    );
    const form = new FormData();
    for (const [name, value] of Object.entries(slot.fields)) form.append(name, value);
    form.append('file', new Blob([sealed], { type: 'application/octet-stream' })); // the file part must come last
    const uploaded = await fetch(slot.url, { method: 'POST', body: form });
    if (!uploaded.ok) throw new Error(`Upload failed (${uploaded.status})`);

    const id = await this.submit(
      conversationId,
      {
        case: 'media',
        value: create(pb.MediaSchema, {
          kind: info.kind,
          objectKey: slot.object_key,
          key,
          nonce,
          sha256,
          sizeBytes: BigInt(file.size),
          mimeType: info.mimeType,
          fileName: info.fileName,
          width: info.width ?? 0,
          height: info.height ?? 0,
          durationMs: info.durationMs ?? 0,
          thumbnail: info.thumbnail,
          waveform: info.waveform,
          caption: info.caption ?? '',
        }),
      },
      opts,
    );
    this.cacheMedia(id, file.type === info.mimeType ? file : new Blob([file], { type: info.mimeType }));
    return id;
  }

  /** Downloads, verifies and decrypts a message's attachment. */
  async loadMedia(message: LocalMessage): Promise<Blob> {
    const cached = this.mediaCache.get(message.id);
    if (cached) {
      this.cacheMedia(message.id, cached);
      return cached;
    }
    const media = message.media;
    if (!media) throw new Error('Message has no attachment');

    const { url } = await this.http.post<{ url: string }>('/pulse/media/download-url', {
      conversation_id: message.conversationId,
      object_key: media.objectKey,
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const sealed = await res.arrayBuffer();
    // The hash came inside the signed message, so a swapped or corrupted blob is caught here.
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', sealed));
    if (toHex(digest) !== toHex(media.sha256)) throw new Error('Attachment failed its integrity check');

    const aes = await crypto.subtle.importKey('raw', new Uint8Array(media.key), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(media.nonce) }, aes, sealed);
    const blob = new Blob([plain], { type: media.mimeType });
    this.cacheMedia(message.id, blob);
    return blob;
  }

  private cacheMedia(id: string, blob: Blob): void {
    this.mediaCache.delete(id);
    this.mediaCache.set(id, blob);
    if (this.mediaCache.size > MEDIA_CACHE_ENTRIES) this.mediaCache.delete(this.mediaCache.keys().next().value!);
  }

  /** Sets this user's reaction on a message; an empty emoji removes it. */
  react(conversationId: string, targetId: string, emoji: string): Promise<string> {
    return this.submit(conversationId, {
      case: 'reaction',
      value: create(pb.ReactionSchema, { targetId: uuidToBytes(targetId), emoji }),
    });
  }

  editMessage(conversationId: string, targetId: string, text: string): Promise<string> {
    return this.submit(conversationId, {
      case: 'edit',
      value: create(pb.EditSchema, { targetId: uuidToBytes(targetId), text: create(pb.TextSchema, { body: text }) }),
    });
  }

  deleteMessage(conversationId: string, targetId: string): Promise<string> {
    return this.submit(conversationId, { case: 'delete', value: create(pb.DeleteSchema, { targetId: uuidToBytes(targetId) }) });
  }

  /** Marks everything received so far in the conversation as read (blue ticks for the senders). */
  markRead(conversationId: string): Promise<void> {
    return this.run(async () => {
      const conv = this.convs.get(conversationId);
      const me = conv?.members.find((m) => m.user_id === this.userId);
      const cursor = await this.cursor(conversationId);
      if (!conv || !me || me.read_seq >= cursor) return;
      me.read_seq = cursor;
      me.delivered_seq = Math.max(me.delivered_seq, cursor);
      this.socket.notify({ case: 'read', value: create(pb.WatermarkSchema, { conversationId: uuidToBytes(conversationId), seq: BigInt(cursor) }) });
      this.emit({ type: 'conversations' });
    });
  }

  setTyping(conversationId: string, active: boolean): void {
    this.socket?.notify({ case: 'typing', value: create(pb.TypingSchema, { conversationId: uuidToBytes(conversationId), active }) });
  }

  private async submit(conversationId: string, body: pb.Content['body'], opts: SendOptions = {}): Promise<string> {
    const id = uuidv7();
    const now = Date.now();
    const content = create(pb.ContentSchema, {
      body,
      replyToId: opts.replyToId ? uuidToBytes(opts.replyToId) : undefined,
      threadRootId: opts.threadRootId ? uuidToBytes(opts.threadRootId) : undefined,
      tags: (opts.tags ?? []).map((t) =>
        create(pb.TagSchema, {
          type: t.type,
          id: uuidToBytes(t.id),
          offset: t.offset ?? 0,
          length: t.length ?? 0,
          snapshotTitle: t.title ?? '',
          snapshotStatus: t.status ?? '',
        }),
      ),
    });
    // Shown immediately; the outbox delivers it as soon as there is a connection and a key.
    await this.run(async () => {
      await this.storage.putOutbox({ id, conversationId, content: toBinary(pb.ContentSchema, content), createdAt: now });
      await this.applyContent({ id, conversationId, senderId: this.userId, senderDeviceId: this.deviceId, ts: now, status: 'pending' }, content);
      this.emit({ type: 'messages', conversationId });
    });
    void this.run(() => this.flushOutbox());
    return id;
  }

  // ───────────────────────────── Sync ─────────────────────────────

  private async cursor(conversationId: string): Promise<number> {
    let c = this.cursors.get(conversationId);
    if (c === undefined) {
      c = (await this.storage.get<number>(`cursor:${conversationId}`)) ?? 0;
      this.cursors.set(conversationId, c);
    }
    return c;
  }

  private async setCursor(conversationId: string, seq: number): Promise<void> {
    this.cursors.set(conversationId, seq);
    await this.storage.set(`cursor:${conversationId}`, seq);
  }

  private saveConversations(): Promise<void> {
    return this.storage.set('conversations', [...this.convs.values()]);
  }

  /** Runs after every (re)connect: refetch conversations, fill gaps, fix up membership, drain the outbox. */
  private async resync(): Promise<void> {
    const list = await this.http.get<PulseConversation[]>('/pulse/conversations');
    this.convs = new Map(list.map((c) => [c.id, c]));
    await this.saveConversations();
    this.emit({ type: 'conversations' });

    await this.setUp(list);
    await this.flushOutbox();
    await this.replenishKeyPackages();
  }

  /** Brings the given conversations' encryption groups and message logs up to date. */
  private async setUp(convs: PulseConversation[]): Promise<void> {
    const directory = await this.lookupDevices(convs);
    for (const conv of convs) {
      this.ensureGroup(conv);
      await this.catchUp(conv.id);
      await this.reconcile(conv, directory);
    }
    await this.persist();
  }

  private async lookupDevices(convs: PulseConversation[]): Promise<Directory> {
    const userIds = [...new Set(convs.flatMap((c) => c.members.map((m) => m.user_id)))];
    const directory: Directory = new Map();
    for (let i = 0; i < userIds.length; i += 1000) {
      const devices = await this.http.post<DeviceInfo[]>('/pulse/devices/lookup', { user_ids: userIds.slice(i, i + 1000) });
      for (const d of devices) {
        const list = directory.get(d.user_id);
        if (list) list.push(d);
        else directory.set(d.user_id, [d]);
      }
    }
    return directory;
  }

  /**
   * Only the creator starts a conversation's group, and only while the server
   * still shows epoch 0. Everyone else (including the creator's other
   * devices) waits to be welcomed into it.
   */
  private ensureGroup(conv: PulseConversation): void {
    const gid = uuidToBytes(conv.id);
    if (this.device.hasGroup(gid)) return;
    if (conv.created_by !== this.userId || conv.epoch !== 0) return;
    this.device.createGroup(gid);
  }

  /** Pulls the conversation log forward from this device's cursor. */
  private async catchUp(conversationId: string): Promise<void> {
    const gid = uuidToBytes(conversationId);
    if (!this.device.hasGroup(gid)) return;
    let applied = false;
    for (;;) {
      const reply = await this.socket.request({
        case: 'sync',
        value: create(pb.SyncSchema, { conversationId: gid, afterSeq: BigInt(await this.cursor(conversationId)), limit: SYNC_PAGE }),
      });
      if (reply.body.case !== 'syncBatch') break;
      for (const env of reply.body.value.messages) {
        if (await this.applyEnvelope(env)) applied = true;
      }
      if (!reply.body.value.hasMore) break;
    }
    // Always, not only when something was applied: the log may have been read
    // before this device knew the conversation's members.
    await this.ackDelivered(conversationId);
    if (applied) {
      this.emit({ type: 'messages', conversationId });
      this.emit({ type: 'conversations' });
    }
  }

  /** Tells the senders that this device now holds everything up to its cursor (double tick). */
  private async ackDelivered(conversationId: string): Promise<void> {
    const me = this.convs.get(conversationId)?.members.find((m) => m.user_id === this.userId);
    const cursor = await this.cursor(conversationId);
    if (!me || me.delivered_seq >= cursor) return;
    me.delivered_seq = cursor;
    this.socket.notify({ case: 'delivered', value: create(pb.WatermarkSchema, { conversationId: uuidToBytes(conversationId), seq: BigInt(cursor) }) });
  }

  // ───────────────────────────── Incoming ─────────────────────────────

  private async handleFrame(frame: pb.ServerFrame): Promise<void> {
    const body = frame.body;
    switch (body.case) {
      case 'message': {
        const conversationId = bytesToUuid(body.value.conversationId);
        if (!this.device.hasGroup(body.value.conversationId)) return; // not welcomed yet; synced after joining
        if (Number(body.value.seq) > (await this.cursor(conversationId)) + 1) {
          await this.catchUp(conversationId); // missed something: fill the gap in order
          return;
        }
        if (await this.applyEnvelope(body.value)) {
          await this.ackDelivered(conversationId);
          this.emit({ type: 'messages', conversationId });
          this.emit({ type: 'conversations' });
        }
        return;
      }
      case 'receipt': {
        const conv = this.convs.get(bytesToUuid(body.value.conversationId));
        const member = conv?.members.find((m) => m.user_id === bytesToUuid(body.value.userId));
        if (!conv || !member) return;
        member.delivered_seq = Math.max(member.delivered_seq, Number(body.value.deliveredSeq));
        member.read_seq = Math.max(member.read_seq, Number(body.value.readSeq));
        this.emit({ type: 'conversations' });
        this.emit({ type: 'messages', conversationId: conv.id });
        return;
      }
      case 'typing':
        this.emit({
          type: 'typing',
          conversationId: bytesToUuid(body.value.conversationId),
          userId: bytesToUuid(body.value.userId),
          active: body.value.active,
        });
        return;
      case 'direct':
        await this.handleDirect(body.value);
        return;
      case 'conversationChanged':
        this.scheduleRefresh(bytesToUuid(body.value.conversationId), Math.random() * 400);
        return;
      default:
        return;
    }
  }

  /** Applies one log entry if it is the next in order. Returns whether it was applied. */
  private async applyEnvelope(env: pb.Envelope): Promise<boolean> {
    const conversationId = bytesToUuid(env.conversationId);
    const seq = Number(env.seq);
    if (seq !== (await this.cursor(conversationId)) + 1) return false;

    const senderId = bytesToUuid(env.senderId);
    if (env.kind === pb.MessageKind.HANDSHAKE) {
      await this.applyHandshake(conversationId, env);
    } else {
      await this.applyApplication(conversationId, seq, senderId, env);
    }
    await this.setCursor(conversationId, seq);

    const conv = this.convs.get(conversationId);
    if (conv) {
      conv.last_seq = Math.max(conv.last_seq, seq);
      conv.last_message_at = new Date(Number(env.serverTs)).toISOString();
      // Sending implies the sender has everything up to their own message.
      const sender = conv.members.find((m) => m.user_id === senderId);
      if (sender) {
        sender.delivered_seq = Math.max(sender.delivered_seq, seq);
        sender.read_seq = Math.max(sender.read_seq, seq);
      }
    }
    return true;
  }

  private async applyHandshake(conversationId: string, env: pb.Envelope): Promise<void> {
    const gid = env.conversationId;
    const current = Number(this.device.currentEpoch(gid));
    const epoch = Number(env.epoch);
    if (epoch <= current) return; // from before this device joined, or already applied
    if (epoch !== current + 1) {
      console.error(`[pulse] ${conversationId}: commit for epoch ${epoch} but this device is at ${current}`);
      return;
    }
    const key = `commit:${conversationId}`;
    const mine = await this.storage.get<PendingCommit>(key);
    try {
      if (bytesToUuid(env.senderDeviceId) === this.deviceId) {
        // Our own commit, accepted by the server although we never saw the ack.
        this.device.mergePending(gid);
        if (mine) await this.storage.set(key, { ...mine, stage: 'merged' } satisfies PendingCommit);
      } else {
        if (mine?.stage === 'staged') {
          // Someone else took this epoch first; ours can never be accepted now.
          this.device.discardPending(gid);
          await this.storage.set(key, undefined);
        }
        this.device.processCommit(gid, env.ciphertext);
      }
      const conv = this.convs.get(conversationId);
      if (conv) conv.epoch = Math.max(conv.epoch, epoch);
    } catch (e) {
      console.error(`[pulse] ${conversationId}: could not apply commit for epoch ${epoch}`, e);
    }
    await this.persist();
  }

  private async senderKey(gid: Uint8Array, identity: Uint8Array): Promise<Uint8Array | undefined> {
    const slot = `idkey:${toHex(identity)}`;
    const member = this.device.memberKey(gid, identity);
    if (member) {
      // Remembered so messages from a device that later leaves still verify.
      if (!this.senderKeys.has(slot)) {
        this.senderKeys.set(slot, member);
        await this.storage.set(slot, member);
      }
      return member;
    }
    let cached = this.senderKeys.get(slot);
    if (!cached) {
      cached = await this.storage.get<Uint8Array>(slot);
      if (cached) this.senderKeys.set(slot, cached);
    }
    return cached;
  }

  private async applyApplication(conversationId: string, seq: number, senderId: string, env: pb.Envelope): Promise<void> {
    const id = bytesToUuid(env.id);
    const senderDeviceId = bytesToUuid(env.senderDeviceId);
    const ts = Number(env.serverTs);

    let content: pb.Content | undefined;
    try {
      const identity = PulseDevice.frameSender(env.ciphertext);
      // The signed sender inside the ciphertext must be who the server says sent it.
      if (toHex(identity) !== toHex(concat(env.senderId, env.senderDeviceId))) throw new Error('sender mismatch');
      const key = await this.senderKey(env.conversationId, identity);
      if (!key) throw new Error('unknown sender');
      content = fromBinary(pb.ContentSchema, this.device.decrypt(env.conversationId, env.ciphertext, key).plaintext);
    } catch {
      content = undefined;
    }

    if (content) {
      await this.applyContent({ id, conversationId, seq, senderId, senderDeviceId, ts, status: 'sent' }, content);
      return;
    }
    // No key for it (sent before this device joined and not shared yet) or it failed verification.
    const existing = await this.storage.getMessage(conversationId, id);
    if (existing && !existing.unavailable) {
      await this.storage.putMessage({ ...existing, seq, order: seq, ts, status: 'sent' });
      return;
    }
    await this.storage.putMessage({
      id, conversationId, seq, order: seq, senderId, senderDeviceId, ts, status: 'sent',
      text: '', tags: [], reactions: {}, edited: false, deleted: false, unavailable: true,
    });
  }

  /** Folds decrypted content into the local store: new messages, and reactions/edits/deletes onto their targets. */
  private async applyContent(
    meta: { id: string; conversationId: string; seq?: number; senderId: string; senderDeviceId: string; ts: number; status: LocalMessage['status'] },
    content: pb.Content,
  ): Promise<void> {
    const { conversationId, senderId } = meta;
    const body = content.body;
    if (body.case === 'reaction' || body.case === 'edit' || body.case === 'delete') {
      // Read before this device had the key, the entry was stored as an unreadable placeholder.
      // It is not a message of its own, so the placeholder goes once the entry can be applied.
      const placeholder = await this.storage.getMessage(conversationId, meta.id);
      if (placeholder?.unavailable) await this.storage.deleteMessage(conversationId, meta.id);
    }
    switch (body.case) {
      case 'text':
      case 'media': {
        const prev = await this.storage.getMessage(conversationId, meta.id);
        const media = body.case === 'media' ? body.value : undefined;
        await this.storage.putMessage({
          ...meta,
          order: meta.seq ?? pendingOrder(meta.ts),
          text: body.case === 'text' ? body.value.body : body.value.caption,
          media: media && {
            kind: media.kind, objectKey: media.objectKey, key: media.key, nonce: media.nonce, sha256: media.sha256,
            sizeBytes: Number(media.sizeBytes), mimeType: media.mimeType, fileName: media.fileName,
            width: media.width, height: media.height, durationMs: media.durationMs,
            thumbnail: media.thumbnail, waveform: media.waveform, caption: media.caption,
          },
          replyToId: content.replyToId.length ? bytesToUuid(content.replyToId) : undefined,
          threadRootId: content.threadRootId.length ? bytesToUuid(content.threadRootId) : undefined,
          tags: content.tags.map((t) => ({
            type: t.type, id: bytesToUuid(t.id), offset: t.offset, length: t.length, title: t.snapshotTitle, status: t.snapshotStatus,
          })),
          reactions: prev?.reactions ?? {},
          edited: false,
          deleted: false,
          unavailable: false,
        });
        return;
      }
      case 'reaction': {
        const target = await this.storage.getMessage(conversationId, bytesToUuid(body.value.targetId));
        if (!target) return;
        if (body.value.emoji) target.reactions[senderId] = body.value.emoji;
        else delete target.reactions[senderId];
        await this.storage.putMessage(target);
        return;
      }
      case 'edit': {
        const target = await this.storage.getMessage(conversationId, bytesToUuid(body.value.targetId));
        if (!target || target.senderId !== senderId || target.deleted) return; // only the author may edit
        await this.storage.putMessage({ ...target, text: body.value.text?.body ?? '', edited: true });
        return;
      }
      case 'delete': {
        const target = await this.storage.getMessage(conversationId, bytesToUuid(body.value.targetId));
        if (!target || target.senderId !== senderId) return; // only the author may delete
        await this.storage.putMessage({ ...target, text: '', media: undefined, tags: [], deleted: true });
        return;
      }
      default:
        return;
    }
  }

  private async handleDirect(direct: pb.Direct): Promise<void> {
    const type = direct.payload[0];
    const body = direct.payload.subarray(1);
    try {
      if (type === DIRECT_WELCOME) {
        if (!this.device.hasGroup(direct.conversationId)) {
          const conversationId = bytesToUuid(this.device.join(body));
          await this.persist();
          this.scheduleRefresh(conversationId, 0);
        }
      } else if (type === DIRECT_HISTORY_KEYS && this.device.hasGroup(direct.conversationId)) {
        const gid = direct.conversationId;
        const identity = PulseDevice.frameSender(body);
        if (toHex(identity) !== toHex(concat(direct.fromUserId, direct.fromDeviceId))) throw new Error('sender mismatch');
        const key = await this.senderKey(gid, identity);
        if (!key) throw new Error('history keys from a device outside the group');
        const keys = this.device.decrypt(gid, body, key).plaintext;
        const view = new DataView(keys.buffer, keys.byteOffset, keys.byteLength);
        for (let off = 0; off + 40 <= keys.length; off += 40) {
          this.device.importEpochKey(gid, view.getBigUint64(off), keys.subarray(off + 8, off + 40));
        }
        await this.persist();
        // Re-read the log so messages stored before this device joined become readable.
        const conversationId = bytesToUuid(gid);
        await this.setCursor(conversationId, 0);
        this.scheduleRefresh(conversationId, 0);
      }
    } catch (e) {
      console.error('[pulse] could not process device payload', e);
    }
    this.socket.notify({ case: 'directAck', value: create(pb.DirectAckSchema, { ids: [direct.id] }) });
  }

  private scheduleRefresh(conversationId: string, delayMs: number): void {
    if (this.stopped || this.refreshTimers.has(conversationId)) return;
    this.refreshTimers.set(
      conversationId,
      setTimeout(() => {
        this.refreshTimers.delete(conversationId);
        void this.run(() => this.refreshConversation(conversationId));
      }, delayMs),
    );
  }

  /** Refetches one conversation after its membership or this device's access to it changed. */
  private async refreshConversation(conversationId: string): Promise<void> {
    let conv: PulseConversation;
    try {
      conv = await this.http.get<PulseConversation>(`/pulse/conversations/${conversationId}`);
    } catch (e) {
      if (e instanceof Error && e.message === 'Not found') {
        this.convs.delete(conversationId); // removed from it
        await this.saveConversations();
        this.emit({ type: 'conversations' });
      }
      return;
    }
    this.convs.set(conversationId, conv);
    await this.saveConversations();
    this.emit({ type: 'conversations' });
    await this.setUp([conv]);
    await this.flushOutbox();
  }

  // ───────────────────────────── Membership ─────────────────────────────

  private identityOf(d: DeviceInfo): Uint8Array {
    return concat(uuidToBytes(d.user_id), uuidToBytes(d.id));
  }

  /**
   * Makes the encryption group match the server's member list: every active
   * device of every member is in, everything else is out. Any member's device
   * may do this; the server's epoch ordering lets exactly one commit win.
   */
  private async reconcile(conv: PulseConversation, directory: Directory): Promise<void> {
    const gid = uuidToBytes(conv.id);
    if (!this.device.hasGroup(gid)) return;

    // Finish a commit left over from an earlier attempt before planning a new one.
    if ((await this.driveCommit(conv)) === 'conflict') return;

    const want = new Map<string, DeviceInfo>();
    for (const m of conv.members) for (const d of directory.get(m.user_id) ?? []) want.set(toHex(this.identityOf(d)), d);
    const have = new Set(this.device.memberIdentities(gid).map(toHex));
    const me = toHex(this.identity);

    const remove = [...have].filter((h) => h !== me && !want.has(h));
    if (remove.length) {
      const identities = remove.map((h) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16))));
      if ((await this.stage(conv, () => this.device.removeMembers(gid, identities), [])) !== 'ok') return;
    }

    const add = [...want].filter(([h]) => h !== me && !have.has(h)).map(([, d]) => d);
    if (add.length) {
      const packages: Uint8Array[] = [];
      const added: string[] = [];
      for (const userId of new Set(add.map((d) => d.user_id))) {
        const claimed = await this.http.post<ClaimedKeyPackage[]>(`/pulse/users/${userId}/key-packages/claim`);
        for (const d of add.filter((x) => x.user_id === userId)) {
          const kp = claimed.find((c) => c.device_id === d.id);
          if (!kp) continue; // out of key packages; picked up on a later pass
          const bytes = b64decode(kp.key_package);
          try {
            // The package must be signed by, and name, the device we asked for.
            if (toHex(this.device.keyPackageIdentity(bytes)) !== toHex(this.identityOf(d))) continue;
          } catch {
            continue;
          }
          packages.push(bytes);
          added.push(d.id);
        }
      }
      if (packages.length) {
        await this.stage(conv, () => this.device.addMembers(gid, packages), added);
        return;
      }
    }

    // A brand-new group with nobody to add yet still has to claim its first epoch.
    if (this.device.currentEpoch(gid) === 0n) await this.stage(conv, () => this.device.selfUpdate(gid), []);
  }

  private async stage(
    conv: PulseConversation,
    build: () => { commit: Uint8Array; welcome?: Uint8Array; epoch: bigint },
    welcomeTo: string[],
  ): Promise<'ok' | 'conflict'> {
    try {
      this.device.discardPending(uuidToBytes(conv.id)); // a staged commit that never got a record was never sent
    } catch {
      // nothing was pending
    }
    const staged = build();
    // Keys first, then the record: a record without its staged keys could never be completed.
    await this.persist();
    await this.storage.set(`commit:${conv.id}`, {
      id: uuidv7(),
      commit: staged.commit,
      epoch: Number(staged.epoch),
      stage: 'staged',
      welcome: staged.welcome,
      welcomeTo,
    } satisfies PendingCommit);
    return (await this.driveCommit(conv)) === 'conflict' ? 'conflict' : 'ok';
  }

  /** Pushes a recorded commit through: send, merge on acceptance, then welcome the added devices. */
  private async driveCommit(conv: PulseConversation): Promise<'none' | 'ok' | 'conflict'> {
    const key = `commit:${conv.id}`;
    const gid = uuidToBytes(conv.id);
    let rec = await this.storage.get<PendingCommit>(key);
    if (!rec) return 'none';

    if (rec.stage === 'staged') {
      let reply: pb.ServerFrame;
      try {
        reply = await this.socket.request({
          case: 'send',
          value: create(pb.SendSchema, {
            conversationId: gid, id: uuidToBytes(rec.id), kind: pb.MessageKind.HANDSHAKE, ciphertext: rec.commit, epoch: BigInt(rec.epoch),
          }),
        });
      } catch (e) {
        if (!isCode(e, pb.ErrorCode.CONFLICT)) throw e; // transient: the record stays and is retried
        try {
          this.device.discardPending(gid);
          // A group still at epoch 0 was our own attempt to start the conversation and lost;
          // drop it and wait to be welcomed into the winner's.
          if (this.device.currentEpoch(gid) === 0n) {
            this.device.dropGroup(gid);
            conv.epoch = Math.max(conv.epoch, 1);
          }
        } catch (err) {
          console.error('[pulse] could not roll back a rejected commit', err);
        }
        await this.storage.set(key, undefined);
        await this.persist();
        this.scheduleRefresh(conv.id, 500 + Math.random() * 1000);
        return 'conflict';
      }

      if (Number(this.device.currentEpoch(gid)) < rec.epoch) this.device.mergePending(gid);
      await this.persist();
      rec = { ...rec, stage: 'merged' };
      await this.storage.set(key, rec);
      conv.epoch = Math.max(conv.epoch, rec.epoch);
      if (reply.body.case === 'sendAck') {
        const seq = Number(reply.body.value.seq);
        if (seq === (await this.cursor(conv.id)) + 1) await this.setCursor(conv.id, seq);
        conv.last_seq = Math.max(conv.last_seq, seq);
      }
    }

    await this.welcome(conv, rec);
    await this.storage.set(key, undefined);
    return 'ok';
  }

  /** Sends the welcome, then this device's older message keys, to each newly added device. */
  private async welcome(conv: PulseConversation, rec: PendingCommit): Promise<void> {
    if (!rec.welcome || rec.welcomeTo.length === 0) return;
    const gid = uuidToBytes(conv.id);

    const payloads: Uint8Array[] = [concat(Uint8Array.of(DIRECT_WELCOME), rec.welcome)];
    const keys: Uint8Array[] = [];
    for (let epoch = 0; epoch < rec.epoch; epoch++) {
      const key = this.device.epochKey(gid, BigInt(epoch));
      if (!key) continue;
      const entry = new Uint8Array(40);
      new DataView(entry.buffer).setBigUint64(0, BigInt(epoch));
      entry.set(key, 8);
      keys.push(entry);
    }
    // Sealed for the new epoch, which only the group (now including the new devices) can open.
    for (let i = 0; i < keys.length; i += HISTORY_KEYS_PER_FRAME) {
      const frame = this.device.encrypt(gid, concat(...keys.slice(i, i + HISTORY_KEYS_PER_FRAME)));
      payloads.push(concat(Uint8Array.of(DIRECT_HISTORY_KEYS), frame));
    }

    for (const deviceId of rec.welcomeTo) {
      for (const payload of payloads) {
        try {
          await this.socket.request({
            case: 'directSend',
            value: create(pb.DirectSendSchema, { toDeviceId: uuidToBytes(deviceId), conversationId: gid, payload }),
          });
        } catch (e) {
          if (isTransient(e)) throw e; // keep the record; retried on the next pass
          break; // the device is gone (revoked); nothing to deliver
        }
      }
    }
  }

  // ───────────────────────────── Outbox ─────────────────────────────

  /** Sends queued messages in order. Safe to call at any time; retries reuse the same id, so nothing is duplicated. */
  private async flushOutbox(): Promise<void> {
    for (const item of await this.storage.listOutbox()) {
      if (!this.socket.connected) return;
      const gid = uuidToBytes(item.conversationId);
      // No usable key yet (waiting to be welcomed, or the group is still being started).
      if (!this.device.hasGroup(gid) || this.device.currentEpoch(gid) === 0n) continue;

      let reply: pb.ServerFrame;
      try {
        reply = await this.socket.request({
          case: 'send',
          value: create(pb.SendSchema, {
            conversationId: gid,
            id: uuidToBytes(item.id),
            kind: pb.MessageKind.APPLICATION,
            ciphertext: this.device.encrypt(gid, item.content),
            epoch: this.device.currentEpoch(gid),
          }),
        });
      } catch (e) {
        if (isTransient(e)) return; // try again on the next flush
        await this.storage.deleteOutbox(item.id);
        const failed = await this.storage.getMessage(item.conversationId, item.id);
        if (failed) await this.storage.putMessage({ ...failed, status: 'failed' });
        this.emit({ type: 'messages', conversationId: item.conversationId });
        continue;
      }

      await this.storage.deleteOutbox(item.id);
      if (reply.body.case !== 'sendAck') continue;
      const seq = Number(reply.body.value.seq);
      const sent = await this.storage.getMessage(item.conversationId, item.id);
      if (sent) await this.storage.putMessage({ ...sent, seq, order: seq, ts: Number(reply.body.value.serverTs), status: 'sent' });
      if (seq === (await this.cursor(item.conversationId)) + 1) await this.setCursor(item.conversationId, seq);

      const conv = this.convs.get(item.conversationId);
      if (conv) {
        conv.last_seq = Math.max(conv.last_seq, seq);
        conv.last_message_at = new Date(Number(reply.body.value.serverTs)).toISOString();
        const me = conv.members.find((m) => m.user_id === this.userId);
        if (me) {
          me.delivered_seq = Math.max(me.delivered_seq, seq);
          me.read_seq = Math.max(me.read_seq, seq);
        }
      }
      this.emit({ type: 'messages', conversationId: item.conversationId });
      this.emit({ type: 'conversations' });
    }
  }

  /** Keeps enough one-time key packages on the server for others to add this device while it is offline. */
  private async replenishKeyPackages(): Promise<void> {
    const { remaining } = await this.http.get<{ remaining: number }>(`/pulse/devices/${this.deviceId}/key-packages`);
    if (remaining >= KEY_PACKAGE_LOW_WATER) return;
    const keyPackages = this.newKeyPackages(KEY_PACKAGE_BATCH);
    await this.persist();
    await this.http.post(`/pulse/devices/${this.deviceId}/key-packages`, { key_packages: keyPackages });
  }
}
