// One persistent WebSocket to the Pulse gateway: binary protobuf frames,
// request/response matching by req_id, and automatic reconnection.

import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { ClientFrameSchema, ErrorCode, PingSchema, ServerFrameSchema, type ClientFrame, type ServerFrame } from './gen/pulse_pb';

export type ClientBody = Exclude<ClientFrame['body'], { case: undefined }>;

export class PulseSocketError extends Error {
  code: ErrorCode | 'offline' | 'timeout';
  constructor(code: ErrorCode | 'offline' | 'timeout', message: string) {
    super(message);
    this.code = code;
  }
}

export interface PulseSocketOptions {
  /** Resolves a fresh gateway URL (including a single-use ticket) for each attempt. */
  getUrl: () => Promise<string>;
  onOpen: () => void;
  onClose: () => void;
  /** Frames that are not a reply to a request. */
  onFrame: (frame: ServerFrame) => void;
  WebSocketImpl?: typeof WebSocket;
}

const REQUEST_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 25_000;
const BACKOFF_MIN_MS = 500;
const BACKOFF_MAX_MS = 30_000;

interface Pending {
  resolve: (frame: ServerFrame) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PulseSocket {
  private ws: WebSocket | null = null;
  private wanted = false;
  private attempt = 0;
  private nextReqId = 0n;
  private pending = new Map<bigint, Pending>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private opts: PulseSocketOptions;

  /** Last measured round trip to the gateway, in milliseconds. */
  rttMs: number | null = null;

  constructor(opts: PulseSocketOptions) {
    this.opts = opts;
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === 1;
  }

  start(): void {
    if (this.wanted) return;
    this.wanted = true;
    void this.open();
  }

  stop(): void {
    this.wanted = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
  }

  /** Drops the current connection; it reconnects on its own if still wanted. */
  reconnect(): void {
    this.ws?.close();
  }

  private async open(): Promise<void> {
    let ws: WebSocket;
    try {
      const url = await this.opts.getUrl();
      if (!this.wanted) return;
      ws = new (this.opts.WebSocketImpl ?? WebSocket)(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
      this.opts.onOpen();
    };
    ws.onmessage = (ev: MessageEvent) => {
      if (typeof ev.data === 'string') return;
      let frame: ServerFrame;
      try {
        frame = fromBinary(ServerFrameSchema, new Uint8Array(ev.data as ArrayBuffer));
      } catch {
        return;
      }
      const waiter = frame.reqId !== 0n ? this.pending.get(frame.reqId) : undefined;
      if (!waiter) {
        this.opts.onFrame(frame);
        return;
      }
      this.pending.delete(frame.reqId);
      clearTimeout(waiter.timer);
      if (frame.body.case === 'error') {
        waiter.reject(new PulseSocketError(frame.body.value.code, frame.body.value.message));
      } else {
        waiter.resolve(frame);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      for (const [, waiter] of this.pending) {
        clearTimeout(waiter.timer);
        waiter.reject(new PulseSocketError('offline', 'connection closed'));
      }
      this.pending.clear();
      this.opts.onClose();
      if (this.wanted) this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleReconnect(): void {
    if (!this.wanted || this.reconnectTimer) return;
    // Exponential backoff with jitter, so a server restart is not met by every client at once.
    const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** this.attempt++);
    const delay = ceiling / 2 + Math.random() * (ceiling / 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, delay);
  }

  private ping(): void {
    const sent = Date.now();
    this.request({ case: 'ping', value: create(PingSchema, { clientTs: BigInt(sent) }) })
      .then(() => {
        this.rttMs = Date.now() - sent;
      })
      // No answer: the connection is dead even if the browser has not noticed.
      .catch(() => this.ws?.close());
  }

  private write(reqId: bigint, body: ClientBody): boolean {
    if (!this.connected) return false;
    this.ws!.send(toBinary(ClientFrameSchema, create(ClientFrameSchema, { reqId, body })));
    return true;
  }

  /** Sends a frame and resolves with its reply; rejects on an Error reply, timeout, or disconnect. */
  request(body: ClientBody): Promise<ServerFrame> {
    return new Promise((resolve, reject) => {
      const reqId = ++this.nextReqId;
      if (!this.write(reqId, body)) {
        reject(new PulseSocketError('offline', 'not connected'));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new PulseSocketError('timeout', 'request timed out'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(reqId, { resolve, reject, timer });
    });
  }

  /** Sends a frame that expects no reply. Dropped silently when offline. */
  notify(body: ClientBody): void {
    this.write(0n, body);
  }
}
