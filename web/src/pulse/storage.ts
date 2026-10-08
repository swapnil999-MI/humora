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
    await req(this.store('messages', 'readwrite').put(message));
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
