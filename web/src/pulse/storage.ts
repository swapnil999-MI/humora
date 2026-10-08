// Local persistence for the Pulse client. Messages are stored decrypted on
// the device, so chats open instantly and work offline; the server only ever
// holds ciphertext.

export interface LocalTag {
  type: number;
  id: string;
  offset: number;
  length: number;
  title: string;
  status: string;
}

export interface LocalMedia {
  kind: number;
  objectKey: string;
  key: Uint8Array;
  nonce: Uint8Array;
  sha256: Uint8Array;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
  durationMs: number;
  thumbnail: Uint8Array;
  waveform: Uint8Array;
  caption: string;
}

export interface LocalMessage {
  id: string;
  conversationId: string;
  /** Server sequence number; undefined until the server has stored the message. */
  seq?: number;
  /** Sort key: seq once stored, otherwise a large value that keeps unsent messages last. */
  order: number;
  senderId: string;
  senderDeviceId: string;
  /** Unix ms: server time once stored, local time before that. */
  ts: number;
  status: 'pending' | 'sent' | 'failed';
  text: string;
  media?: LocalMedia;
  replyToId?: string;
  threadRootId?: string;
  tags: LocalTag[];
  /** userId -> emoji. */
  reactions: Record<string, string>;
  edited: boolean;
  deleted: boolean;
  /** Stored on the server but this device has no key for it (yet). */
  unavailable: boolean;
}

export interface OutboxItem {
  id: string;
  conversationId: string;
  /** Serialized, not yet encrypted Content: it is sealed at send time with the then-current key. */
  content: Uint8Array;
  createdAt: number;
}

export interface PulseStorage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  /** Secrets (device key material) are sealed at rest where the platform allows it. */
  getSecret(key: string): Promise<Uint8Array | undefined>;
  setSecret(key: string, value: Uint8Array): Promise<void>;

  putMessage(message: LocalMessage): Promise<void>;
  getMessage(conversationId: string, id: string): Promise<LocalMessage | undefined>;
  deleteMessage(conversationId: string, id: string): Promise<void>;
  /** Newest `limit` messages below `beforeOrder`, returned oldest first. */
  listMessages(conversationId: string, opts?: { beforeOrder?: number; limit?: number }): Promise<LocalMessage[]>;

  putOutbox(item: OutboxItem): Promise<void>;
  deleteOutbox(id: string): Promise<void>;
  /** Oldest first. */
  listOutbox(): Promise<OutboxItem[]>;
}

/** Sort key for a message the server has not acknowledged yet. */
export const pendingOrder = (createdAt: number) => 1e15 + createdAt;

export class MemoryStorage implements PulseStorage {
  private kv = new Map<string, unknown>();
  private messages = new Map<string, Map<string, LocalMessage>>();
  private outbox = new Map<string, OutboxItem>();

  async get<T>(key: string) {
    return this.kv.get(key) as T | undefined;
  }
  async set(key: string, value: unknown) {
    this.kv.set(key, value);
  }
  async getSecret(key: string) {
    return this.kv.get(`secret:${key}`) as Uint8Array | undefined;
  }
  async setSecret(key: string, value: Uint8Array) {
    this.kv.set(`secret:${key}`, value);
  }
  async putMessage(message: LocalMessage) {
    let conv = this.messages.get(message.conversationId);
    if (!conv) this.messages.set(message.conversationId, (conv = new Map()));
    conv.set(message.id, structuredClone(message));
  }
  async getMessage(conversationId: string, id: string) {
    const m = this.messages.get(conversationId)?.get(id);
    return m ? structuredClone(m) : undefined;
  }
  async deleteMessage(conversationId: string, id: string) {
    this.messages.get(conversationId)?.delete(id);
  }
  async listMessages(conversationId: string, opts: { beforeOrder?: number; limit?: number } = {}) {
    const all = [...(this.messages.get(conversationId)?.values() ?? [])]
      .filter((m) => opts.beforeOrder === undefined || m.order < opts.beforeOrder)
      .sort((a, b) => a.order - b.order);
    return structuredClone(opts.limit ? all.slice(-opts.limit) : all);
  }
  async putOutbox(item: OutboxItem) {
    this.outbox.set(item.id, item);
  }
  async deleteOutbox(id: string) {
    this.outbox.delete(id);
  }
  async listOutbox() {
    return [...this.outbox.values()].sort((a, b) => a.createdAt - b.createdAt);
  }
}

const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * IndexedDB-backed storage, one database per signed-in user.
 *
 * Device key material is sealed with an AES-GCM key that the browser holds as
 * non-extractable: script can use it but cannot read or export it, so a copy
 * of the database files alone does not reveal the keys.
 */
export class IndexedDbStorage implements PulseStorage {
  private db: IDBDatabase;
  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static async open(userId: string): Promise<IndexedDbStorage> {
    const open = indexedDB.open(`humora-pulse-${userId}`, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      db.createObjectStore('kv');
      db.createObjectStore('outbox', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      db.createObjectStore('messages', { keyPath: ['conversationId', 'id'] }).createIndex('order', ['conversationId', 'order']);
    };
    return new IndexedDbStorage(await req(open));
  }

  private store(name: string, mode: IDBTransactionMode = 'readonly') {
    return this.db.transaction(name, mode).objectStore(name);
  }

  async get<T>(key: string) {
    return (await req(this.store('kv').get(key))) as T | undefined;
  }
  async set(key: string, value: unknown) {
    await req(this.store('kv', 'readwrite').put(value, key));
  }

  private async sealKey(): Promise<CryptoKey> {
    let key = await this.get<CryptoKey>('seal-key');
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await this.set('seal-key', key);
    }
    return key;
  }
  async getSecret(key: string) {
    const sealed = await this.get<{ iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }>(`secret:${key}`);
    if (!sealed) return undefined;
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, await this.sealKey(), sealed.data));
  }
  async setSecret(key: string, value: Uint8Array) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await this.sealKey(), new Uint8Array(value));
    await this.set(`secret:${key}`, { iv, data });
  }

  async putMessage(message: LocalMessage) {
    // Messages can always be fetched again from the server, so they skip the disk flush.
    await req(this.db.transaction('messages', 'readwrite', { durability: 'relaxed' }).objectStore('messages').put(message));
  }
  async getMessage(conversationId: string, id: string) {
    return (await req(this.store('messages').get([conversationId, id]))) as LocalMessage | undefined;
  }
  async deleteMessage(conversationId: string, id: string) {
    await req(this.store('messages', 'readwrite').delete([conversationId, id]));
  }
  listMessages(conversationId: string, opts: { beforeOrder?: number; limit?: number } = {}) {
    const range = IDBKeyRange.bound([conversationId, -Infinity], [conversationId, opts.beforeOrder ?? Infinity], false, true);
    const cursor = this.store('messages').index('order').openCursor(range, 'prev');
    const out: LocalMessage[] = [];
    return new Promise<LocalMessage[]>((resolve, reject) => {
      cursor.onerror = () => reject(cursor.error);
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c || (opts.limit && out.length >= opts.limit)) {
          resolve(out.reverse());
          return;
        }
        out.push(c.value as LocalMessage);
        c.continue();
      };
    });
  }

  async putOutbox(item: OutboxItem) {
    await req(this.store('outbox', 'readwrite').put(item));
  }
  async deleteOutbox(id: string) {
    await req(this.store('outbox', 'readwrite').delete(id));
  }
  async listOutbox() {
    return (await req(this.store('outbox').index('createdAt').getAll())) as OutboxItem[];
  }
}

/** Newest messages held in memory per conversation, and how many conversations keep them. */
const CACHE_WINDOW = 200;
const CACHE_CONVERSATIONS = 24;

interface CachedWindow {
  byId: Map<string, LocalMessage>;
  /** Every stored message with order >= floor is in byId (-Infinity: the whole conversation is). */
  floor: number;
}

const BACKGROUND_KEYS = ['cursor:', 'conversations'];

const copy = (m: LocalMessage): LocalMessage => ({ ...m, reactions: { ...m.reactions } });

/**
 * Keeps the hot path off the disk. Reads of recent messages, the outbox and settings are served
 * from memory; writes update memory at once and reach the underlying store in the background,
 * strictly in the order they were made. A crash can therefore lose only the newest writes, never
 * leave a later one (such as an advanced sync cursor) without an earlier one (the message it
 * covers): whatever is lost is fetched again from the server on the next sync.
 *
 * Device secrets are the exception: setSecret resolves only once they are on disk, because the
 * client tells the server it has processed a key change right after saving it.
 */
const caches = new WeakMap<PulseStorage, CachedStorage>();

/** The cache for a store; one per store, so a restarted client never reads around writes still in flight. */
export function cached(storage: PulseStorage): CachedStorage {
  if (storage instanceof CachedStorage) return storage;
  let c = caches.get(storage);
  if (!c) caches.set(storage, (c = new CachedStorage(storage)));
  return c;
}

export class CachedStorage implements PulseStorage {
  private windows = new Map<string, CachedWindow>();
  private loading = new Map<string, Promise<CachedWindow>>();
  private kv = new Map<string, unknown>();
  private outbox: Map<string, OutboxItem> | undefined;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly inner: PulseStorage) {}

  /** Resolves once every write made so far is on disk. */
  flush(): Promise<void> {
    return this.writes;
  }

  private write(op: () => Promise<void>): Promise<void> {
    const done = this.writes.then(op);
    this.writes = done.catch((e) => console.error('[pulse] local write failed', e));
    return done;
  }

  private window(conversationId: string): Promise<CachedWindow> {
    const hit = this.windows.get(conversationId);
    if (hit) {
      // Most recently used last, so the oldest entry is the one evicted.
      this.windows.delete(conversationId);
      this.windows.set(conversationId, hit);
      return Promise.resolve(hit);
    }
    let pending = this.loading.get(conversationId);
    if (!pending) {
      pending = (async () => {
        await this.writes;
        const list = await this.inner.listMessages(conversationId, { limit: CACHE_WINDOW });
        const w: CachedWindow = {
          byId: new Map(list.map((m) => [m.id, m])),
          floor: list.length < CACHE_WINDOW ? -Infinity : list[0].order,
        };
        this.windows.set(conversationId, w);
        this.loading.delete(conversationId);
        while (this.windows.size > CACHE_CONVERSATIONS) this.windows.delete(this.windows.keys().next().value!);
        return w;
      })();
      this.loading.set(conversationId, pending);
    }
    return pending;
  }

  async get<T>(key: string) {
    if (this.kv.has(key)) return structuredClone(this.kv.get(key)) as T | undefined;
    await this.writes;
    const value = await this.inner.get<T>(key);
    if (!this.kv.has(key)) this.kv.set(key, value);
    return structuredClone(this.kv.get(key)) as T | undefined;
  }
  async set(key: string, value: unknown) {
    const saved = structuredClone(value);
    this.kv.set(key, saved);
    const done = this.write(() => this.inner.set(key, saved));
    // Sync positions and the conversation list are re-fetched from the server if lost;
    // everything else (such as a pending key change) is on disk before this resolves.
    if (!BACKGROUND_KEYS.some((k) => key.startsWith(k))) await done;
  }
  async getSecret(key: string) {
    await this.writes;
    return this.inner.getSecret(key);
  }
  setSecret(key: string, value: Uint8Array) {
    return this.write(() => this.inner.setSecret(key, value));
  }

  async putMessage(message: LocalMessage) {
    const saved = copy(message);
    const w = await this.window(message.conversationId);
    if (saved.order >= w.floor) w.byId.set(saved.id, saved);
    else w.byId.delete(saved.id);
    void this.write(() => this.inner.putMessage(saved));
  }
  async getMessage(conversationId: string, id: string) {
    const w = await this.window(conversationId);
    const hit = w.byId.get(id);
    if (hit) return copy(hit);
    await this.writes;
    return this.inner.getMessage(conversationId, id);
  }
  async deleteMessage(conversationId: string, id: string) {
    (await this.window(conversationId)).byId.delete(id);
    void this.write(() => this.inner.deleteMessage(conversationId, id));
  }
  async listMessages(conversationId: string, opts: { beforeOrder?: number; limit?: number } = {}) {
    const w = await this.window(conversationId);
    const below = [...w.byId.values()]
      .filter((m) => opts.beforeOrder === undefined || m.order < opts.beforeOrder)
      .sort((a, b) => a.order - b.order);
    // Answerable from memory when the window holds enough, or holds everything there is.
    const fromMemory = w.floor === -Infinity || (opts.limit !== undefined && below.length >= opts.limit);
    if (fromMemory) return (opts.limit ? below.slice(-opts.limit) : below).map(copy);
    await this.writes;
    return this.inner.listMessages(conversationId, opts);
  }

  private async loadOutbox(): Promise<Map<string, OutboxItem>> {
    if (!this.outbox) {
      await this.writes;
      const items = await this.inner.listOutbox();
      this.outbox ??= new Map(items.map((i) => [i.id, i]));
    }
    return this.outbox;
  }
  async putOutbox(item: OutboxItem) {
    (await this.loadOutbox()).set(item.id, item);
    // On disk before it is sent, so an unsent message survives a crash.
    await this.write(() => this.inner.putOutbox(item));
  }
  async deleteOutbox(id: string) {
    (await this.loadOutbox()).delete(id);
    void this.write(() => this.inner.deleteOutbox(id));
  }
  async listOutbox() {
    return [...(await this.loadOutbox()).values()].sort((a, b) => a.createdAt - b.createdAt);
  }
}
