import { create } from 'zustand';
import { api } from '../api/client';
import {
  IndexedDbStorage,
  initPulseCrypto,
  MAX_MEDIA_BYTES,
  MediaKind,
  PulseClient,
  TagType,
  type LocalMessage,
  type PulseEvent,
  type Tick,
} from '../pulse';
import { b64encode } from '../pulse/ids';
import wasmUrl from '../pulse/wasm/pulse_crypto_bg.wasm?url';
import type { Employee } from '../types';
import { useAuthStore } from './authStore';

export interface PulseAttachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'document' | 'code' | 'pdf';
  url: string;
  previewUrl?: string;
}

export interface PulseTaskTag {
  id: string;
  key: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeName: string;
  assigneeAvatar?: string;
  assignedByManager: string;
  storyPoints?: number;
}

export interface PulseReaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs
}

export interface PulseVoiceNote {
  duration: string;
  durationSec?: number;
  waveform: number[];
  transcription?: string;
}

/** The signed-in user appears under this id in messages, reactions and member lists. */
export const CURRENT_USER = 'user-current';

export type PulseTick = Tick;

export interface PulseMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderRole: string;
  content: string;
  timestamp: string;
  createdAt: string;
  attachments?: PulseAttachment[];
  taggedTasks?: PulseTaskTag[];
  reactions?: PulseReaction[];
  voiceNote?: PulseVoiceNote;
  threadRepliesCount?: number;
  /** Set on replies posted inside a thread: the id of the thread's first message. */
  threadRootId?: string;
  isPinned?: boolean;
  isStarred?: boolean;
  /** Delivery state of the user's own messages: one tick, two ticks, blue ticks. */
  tick?: PulseTick;
  isEdited?: boolean;
  isDeleted?: boolean;
  /** Stored encrypted on the server, but this device has not been given its key. */
  isUnavailable?: boolean;
}

interface LastMessage {
  lastMessageSnippet?: string;
  lastMessageTime?: string;
  /** Set when the last message is the user's own. */
  lastMessageTick?: PulseTick;
}

export interface PulseChannel extends LastMessage {
  id: string;
  name: string;
  topic: string;
  isPrivate: boolean;
  memberCount: number;
  unreadCount: number;
  createdAt: string;
  pinnedGoal?: string;
}

export interface PulseDirectMessage extends LastMessage {
  /** Conversation id, or `new:<userId>` for a colleague with no conversation yet. */
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  role: string;
  department: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  statusCustom?: string;
  lastSeen?: string;
  unreadCount: number;
}

export interface PulseMemberView {
  id: string;
  userId: string;
  name: string;
  role: string;
  department: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
  isAdmin?: boolean;
  dmId?: string;
}

export interface PulseState {
  /** idle: not started. starting: loading keys and connecting. ready: usable (possibly offline). */
  status: 'idle' | 'starting' | 'ready' | 'error';
  error: string | null;
  connected: boolean;
  /** conversationId -> names of the other people typing there right now. */
  typing: Record<string, string[]>;
  /** Tells the others in the conversation that this user is typing (throttled). */
  notifyTyping: (conversationId: string) => void;

  activeType: 'channel' | 'dm';
  activeId: string;
  searchQuery: string;
  channels: PulseChannel[];
  directMessages: PulseDirectMessage[];
  messages: Record<string, PulseMessage[]>; // conversationId -> messages
  members: Record<string, PulseMemberView[]>; // conversationId -> members
  isCreateChannelModalOpen: boolean;
  isMentionTaskModalOpen: boolean;
  isHuddleActive: boolean;
  huddleChannelId: string | null;
  activeThreadMessage: PulseMessage | null;

  // Actions
  init: (userId: string) => Promise<void>;
  /** Whether the Pulse screen is on display; incoming messages are only marked read while it is. */
  setViewing: (viewing: boolean) => void;
  setActiveConversation: (id: string, type: 'channel' | 'dm') => void;
  setSearchQuery: (query: string) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    attachments?: PulseAttachment[],
    taggedTasks?: PulseTaskTag[],
    voiceNote?: PulseVoiceNote,
    options?: { threadRootId?: string }
  ) => Promise<void>;
  /** Encrypts and sends a file. Images get a small inline preview. */
  sendFile: (conversationId: string, file: File) => Promise<boolean>;
  /** Encrypts and sends a recorded voice note. */
  sendVoiceNote: (conversationId: string, recording: Blob, durationMs: number) => Promise<boolean>;
  /** Downloads and decrypts a message's attachment; resolves to a local URL for it. */
  openMedia: (messageId: string) => Promise<string | null>;
  toggleReaction: (messageId: string, emoji: string, currentUserId?: string) => void;
  toggleStarMessage: (messageId: string) => void;
  togglePinMessage: (messageId: string) => void;
  toggleHuddle: (channelId: string) => void;
  setActiveThreadMessage: (message: PulseMessage | null) => void;
  createChannel: (name: string, topic: string, isPrivate: boolean) => Promise<void>;
  setCreateChannelModalOpen: (open: boolean) => void;
  setMentionTaskModalOpen: (open: boolean) => void;
}

interface Person {
  name: string;
  role: string;
  department: string;
  avatar?: string;
}

const NEW_DM = 'new:';
const MESSAGE_WINDOW = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Engine state that React does not render directly.
let client: PulseClient | null = null;
let viewing = false;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
const people = new Map<string, Person>();
const lastMessages = new Map<string, LastMessage>();
const unread = new Map<string, number>();
// Stars and pins are kept on this device only; they are not synced to other members yet.
// Decrypted attachments already opened in this session: message id -> object URL.
const mediaUrls = new Map<string, string>();
// Stored form of the messages currently on screen, for attachment lookups.
const localMessages = new Map<string, LocalMessage>();
const starred = new Set<string>();
const pinned = new Set<string>();

const person = (userId: string): Person =>
  people.get(userId) ?? { name: `User ${userId.slice(0, 8)}`, role: '', department: '' };

function formatTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const formatBytes = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;

/** A small JPEG preview and the original dimensions, or nothing if the browser cannot decode the image. */
async function imagePreview(file: Blob): Promise<{ thumbnail?: Uint8Array; width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.6));
    return {
      thumbnail: blob ? new Uint8Array(await blob.arrayBuffer()) : undefined,
      width: bitmap.width,
      height: bitmap.height,
    };
  } catch {
    return {};
  }
}

/** Loudness samples (0-255) and the exact length of a recording. */
async function analyseAudio(recording: Blob, fallbackMs: number): Promise<{ waveform: Uint8Array; durationMs: number }> {
  const bars = 40;
  try {
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(await recording.arrayBuffer());
    void ctx.close();
    const samples = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(samples.length / bars));
    const peaks = Array.from({ length: bars }, (_, i) => {
      let peak = 0;
      for (let j = i * step; j < Math.min(samples.length, (i + 1) * step); j++) peak = Math.max(peak, Math.abs(samples[j]));
      return peak;
    });
    const loudest = Math.max(...peaks, 0.01);
    return { waveform: Uint8Array.from(peaks, (p) => Math.round((p / loudest) * 255)), durationMs: Math.round(audio.duration * 1000) };
  } catch {
    return { waveform: new Uint8Array(bars).fill(90), durationMs: fallbackMs };
  }
}

async function loadPeople(): Promise<void> {
  people.clear();
  for (let page = 1; page <= 50; page++) {
    const res = await api.get<{ items: Employee[] }>(`/hrms/employees?page=${page}&limit=100`);
    const items = res.items || [];
    for (const e of items) {
      if (!e.user_id) continue;
      people.set(e.user_id, {
        name: `${e.first_name} ${e.last_name}`.trim(),
        role: e.designation_title ?? '',
        department: e.department_name ?? '',
        avatar: e.avatar_url,
      });
    }
    if (items.length < 100) break;
  }
}

function toView(m: LocalMessage, me: string): PulseMessage {
  const mine = m.senderId === me;
  const sender = person(m.senderId);

  const byEmoji = new Map<string, string[]>();
  for (const [userId, emoji] of Object.entries(m.reactions)) {
    const users = byEmoji.get(emoji) ?? [];
    users.push(userId === me ? CURRENT_USER : userId);
    byEmoji.set(emoji, users);
  }

  const tasks = m.tags
    .filter((t) => t.type === TagType.TASK)
    .map((t): PulseTaskTag => {
      // The tag carries a label snapshot; live details come from the Work module.
      const [key, ...rest] = t.title.split(' ');
      return {
        id: t.id,
        key,
        title: rest.join(' ') || t.title,
        status: (['todo', 'in_progress', 'review', 'done'].includes(t.status) ? t.status : 'todo') as PulseTaskTag['status'],
        priority: 'medium',
        assigneeName: '',
        assignedByManager: '',
      };
    });

  let attachments: PulseAttachment[] | undefined;
  let voiceNote: PulseVoiceNote | undefined;
  const media = m.deleted ? undefined : m.media;
  if (media && (media.kind === MediaKind.VOICE_NOTE || media.kind === MediaKind.AUDIO)) {
    const seconds = media.durationMs / 1000;
    voiceNote = {
      duration: formatDuration(seconds),
      durationSec: seconds,
      waveform: Array.from(media.waveform.length ? media.waveform : new Uint8Array(40).fill(90), (v) => Math.round((v / 255) * 100)),
    };
  } else if (media) {
    const opened = mediaUrls.get(m.id);
    attachments = [
      {
        id: m.id,
        name: media.fileName,
        size: formatBytes(media.sizeBytes),
        type: media.kind === MediaKind.IMAGE ? 'image' : media.mimeType === 'application/pdf' ? 'pdf' : 'document',
        url: opened ?? '',
        previewUrl:
          media.kind === MediaKind.IMAGE
            ? (opened ?? (media.thumbnail.length ? `data:image/jpeg;base64,${b64encode(media.thumbnail)}` : undefined))
            : undefined,
      },
    ];
  }

  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: mine ? CURRENT_USER : m.senderId,
    senderName: mine ? 'You' : sender.name,
    senderAvatar: sender.avatar,
    senderRole: sender.role,
    content: m.deleted
      ? 'This message was deleted'
      : m.unavailable
        ? 'This message was sent before this device joined the conversation.'
        : m.text,
    timestamp: new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date(m.ts).toISOString(),
    attachments,
    voiceNote,
    taggedTasks: tasks.length ? tasks : undefined,
    reactions: [...byEmoji].map(([emoji, users]) => ({ emoji, count: users.length, users })),
    isPinned: pinned.has(m.id),
    isStarred: starred.has(m.id),
    tick: mine && client ? client.tick(m) : undefined,
    isEdited: m.edited,
    isDeleted: m.deleted,
    isUnavailable: m.unavailable,
    threadRootId: m.threadRootId,
  };
}

export const usePulseStore = create<PulseState>((set, get) => {
  /** Recomputes the sidebar preview and unread badge of one conversation from the local store. */
  const summarize = async (conversationId: string) => {
    if (!client) return;
    const [last] = await client.messages(conversationId, { limit: 1 });
    unread.set(conversationId, await client.unreadCount(conversationId));
    if (!last) {
      lastMessages.delete(conversationId);
      return;
    }
    const view = toView(last, client.userId);
    const preview = view.content || (view.voiceNote ? '🎤 Voice note' : view.attachments ? `📎 ${view.attachments[0].name}` : '');
    lastMessages.set(conversationId, {
      lastMessageSnippet: preview.slice(0, 80),
      lastMessageTime: formatTime(last.ts),
      lastMessageTick: view.tick,
    });
  };

  const loadMessages = async (conversationId: string) => {
    if (!client) return;
    const me = client.userId;
    const list = await client.messages(conversationId, { limit: MESSAGE_WINDOW });
    if (conversationId === get().activeId) {
      localMessages.clear();
      for (const m of list) localMessages.set(m.id, m);
    }
    set((state) => ({ messages: { ...state.messages, [conversationId]: list.map((m) => toView(m, me)) } }));
  };

  const markReadIfVisible = async (conversationId: string) => {
    if (!client || !viewing || document.visibilityState !== 'visible') return;
    await client.markRead(conversationId);
    unread.set(conversationId, 0);
  };

  /** Rebuilds the channel list, the contact list and the member lists from the engine's conversations. */
  const rebuild = () => {
    if (!client) return;
    const me = client.userId;
    const convs = client.conversations();

    const channels: PulseChannel[] = [];
    const directMessages: PulseDirectMessage[] = [];
    const members: Record<string, PulseMemberView[]> = {};
    const dmByUser = new Map<string, string>();

    for (const c of convs) {
      if (c.kind === 'dm') {
        const other = c.members.find((m) => m.user_id !== me)?.user_id;
        if (other) dmByUser.set(other, c.id);
      }
    }

    for (const c of convs) {
      members[c.id] = c.members.map((m) => {
        const self = m.user_id === me;
        const p = person(m.user_id);
        return {
          id: m.user_id,
          userId: self ? CURRENT_USER : m.user_id,
          name: self ? 'You' : p.name,
          role: p.role,
          department: p.department,
          status: 'offline' as const,
          isAdmin: m.role === 'owner' || m.role === 'admin',
          dmId: self ? undefined : (dmByUser.get(m.user_id) ?? NEW_DM + m.user_id),
        };
      });

      if (c.kind !== 'dm') {
        channels.push({
          id: c.id,
          name: c.name,
          topic: c.topic,
          isPrivate: c.is_private,
          memberCount: c.members.length,
          unreadCount: unread.get(c.id) ?? 0,
          createdAt: c.created_at.slice(0, 10),
          ...lastMessages.get(c.id),
        });
        continue;
      }
      const other = c.members.find((m) => m.user_id !== me)?.user_id;
      if (!other) continue;
      const p = person(other);
      directMessages.push({
        id: c.id,
        userId: other,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        department: p.department,
        status: 'offline',
        unreadCount: unread.get(c.id) ?? 0,
        ...lastMessages.get(c.id),
      });
    }

    // Colleagues without a conversation yet are listed as contacts; the DM is created on the first message.
    const contacts = [...people]
      .filter(([userId]) => userId !== me && !dmByUser.has(userId))
      .sort(([, a], [, b]) => a.name.localeCompare(b.name));
    for (const [userId, p] of contacts) {
      directMessages.push({
        id: NEW_DM + userId,
        userId,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        department: p.department,
        status: 'offline',
        unreadCount: 0,
      });
    }

    // Keep the selection valid: follow a contact that just became a conversation, else pick the first entry.
    let { activeId, activeType } = get();
    if (activeId.startsWith(NEW_DM) && dmByUser.has(activeId.slice(NEW_DM.length))) {
      activeId = dmByUser.get(activeId.slice(NEW_DM.length))!;
    }
    const exists = channels.some((c) => c.id === activeId) || directMessages.some((d) => d.id === activeId);
    if (!exists) {
      const first = convs[0];
      if (first) {
        activeId = first.id;
        activeType = first.kind === 'dm' ? 'dm' : 'channel';
      } else {
        activeId = directMessages[0]?.id ?? '';
        activeType = 'dm';
      }
    }
    const changed = activeId !== get().activeId;
    set({ channels, directMessages, members, activeId, activeType });
    if (changed && activeId && !activeId.startsWith(NEW_DM)) {
      void loadMessages(activeId).then(() => markReadIfVisible(activeId)).then(rebuild);
    }
  };

  const scheduleRebuild = () => {
    if (rebuildTimer) return;
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null;
      rebuild();
    }, 30);
  };

  // Typing indicators expire on their own if the "stopped" event never arrives.
  const typingUntil = new Map<string, Map<string, number>>();
  let lastTypingSent = 0;
  const publishTyping = () => {
    const now = Date.now();
    const typing: Record<string, string[]> = {};
    for (const [conv, users] of typingUntil) {
      const names = [...users].filter(([uid, until]) => until > now && uid !== client?.userId).map(([uid]) => person(uid).name);
      if (names.length) typing[conv] = names;
    }
    set({ typing });
  };
  setInterval(publishTyping, 2000);

  const onEvent = (e: PulseEvent) => {
    switch (e.type) {
      case 'connection':
        set({ connected: e.connected });
        return;
      case 'conversations':
        // Receipts land here too, so refresh the open chat's ticks along with the lists.
        if (get().activeId && !get().activeId.startsWith(NEW_DM)) void loadMessages(get().activeId);
        scheduleRebuild();
        return;
      case 'typing': {
        const users = typingUntil.get(e.conversationId) ?? new Map<string, number>();
        if (e.active) users.set(e.userId, Date.now() + 6000);
        else users.delete(e.userId);
        typingUntil.set(e.conversationId, users);
        publishTyping();
        return;
      }
      case 'messages': {
        const active = e.conversationId === get().activeId;
        void (async () => {
          if (active) {
            await loadMessages(e.conversationId);
            await markReadIfVisible(e.conversationId);
          }
          await summarize(e.conversationId);
          scheduleRebuild();
        })();
        return;
      }
      default:
        return;
    }
  };

  /** Resolves a contact entry to a real conversation, creating the DM on first use. */
  const ensureConversation = async (id: string): Promise<string> => {
    if (!id.startsWith(NEW_DM)) return id;
    const conv = await client!.createConversation('dm', [id.slice(NEW_DM.length)]);
    rebuild(); // moves the selection from the contact to the new conversation
    return conv.id;
  };

  const shutdown = () => {
    client?.stop();
    client = null;
    for (const url of mediaUrls.values()) URL.revokeObjectURL(url);
    mediaUrls.clear();
    localMessages.clear();
    lastMessages.clear();
    unread.clear();
    set({ status: 'idle', error: null, connected: false, channels: [], directMessages: [], messages: {}, members: {}, activeId: '' });
  };

  // Stop the engine when the user signs out.
  useAuthStore.subscribe((auth) => {
    if (!auth.isAuthenticated && client) shutdown();
  });

  return {
    status: 'idle',
    error: null,
    connected: false,
    typing: {},

    notifyTyping: (conversationId) => {
      if (!client || !UUID.test(conversationId) || Date.now() - lastTypingSent < 3000) return;
      lastTypingSent = Date.now();
      client.setTyping(conversationId, true);
    },
    activeType: 'channel',
    activeId: '',
    searchQuery: '',
    channels: [],
    directMessages: [],
    messages: {},
    members: {},
    isCreateChannelModalOpen: false,
    isMentionTaskModalOpen: false,
    isHuddleActive: false,
    huddleChannelId: null,
    activeThreadMessage: null,

    init: async (userId) => {
      if (get().status === 'starting') return;
      if (client) {
        if (client.userId === userId) return;
        shutdown(); // a different user signed in on this browser
      }
      set({ status: 'starting', error: null });
      try {
        await initPulseCrypto(wasmUrl);
        await loadPeople();
        const next = new PulseClient({
          userId,
          http: api,
          storage: await IndexedDbStorage.open(userId),
          wsUrl: (ticket) =>
            `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/pulse/ws?ticket=${ticket}`,
        });
        next.subscribe(onEvent);
        await next.start();
        client = next;
        await Promise.all(next.conversations().map((c) => summarize(c.id)));
        rebuild();
        set({ status: 'ready' });
      } catch (err: any) {
        set({ status: 'error', error: err?.message ?? 'Could not start Pulse' });
      }
    },

    setViewing: (value) => {
      viewing = value;
      const { activeId } = get();
      if (value && activeId && !activeId.startsWith(NEW_DM)) void markReadIfVisible(activeId).then(scheduleRebuild);
    },

    setActiveConversation: (id, type) => {
      set({ activeId: id, activeType: type });
      if (id.startsWith(NEW_DM)) return;
      void loadMessages(id)
        .then(() => markReadIfVisible(id))
        .then(scheduleRebuild);
    },

    setSearchQuery: (query) => set({ searchQuery: query }),

    sendMessage: async (conversationId, content, _attachments = [], taggedTasks = [], _voiceNote, options = {}) => {
      const text = content.trim();
      if (!client || !text) return;
      try {
        const id = await ensureConversation(conversationId);
        // Only tags that point at a real element can be sent; the id travels encrypted with the message.
        const tags = taggedTasks
          .filter((t) => UUID.test(t.id))
          .map((t) => ({ type: TagType.TASK, id: t.id, title: `${t.key} ${t.title}`, status: t.status }));
        await client.sendText(id, text, { tags, threadRootId: options.threadRootId });
      } catch (err: any) {
        set({ error: err?.message ?? 'Message could not be sent' });
      }
    },

    sendFile: async (conversationId, file) => {
      if (!client) return false;
      if (file.size > MAX_MEDIA_BYTES - 1024) {
        set({ error: 'Files larger than 100 MB cannot be sent' });
        return false;
      }
      try {
        const id = await ensureConversation(conversationId);
        const isImage = file.type.startsWith('image/');
        await client.sendMedia(id, file, {
          kind: isImage ? MediaKind.IMAGE : file.type.startsWith('video/') ? MediaKind.VIDEO : MediaKind.DOCUMENT,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          ...(isImage ? await imagePreview(file) : {}),
        });
        return true;
      } catch (err: any) {
        set({ error: err?.message ?? 'File could not be sent' });
        return false;
      }
    },

    sendVoiceNote: async (conversationId, recording, durationMs) => {
      if (!client) return false;
      try {
        const id = await ensureConversation(conversationId);
        const audio = await analyseAudio(recording, durationMs);
        await client.sendMedia(id, recording, {
          kind: MediaKind.VOICE_NOTE,
          fileName: 'voice-note',
          mimeType: recording.type || 'audio/webm',
          ...audio,
        });
        return true;
      } catch (err: any) {
        set({ error: err?.message ?? 'Voice note could not be sent' });
        return false;
      }
    },

    openMedia: async (messageId) => {
      const known = mediaUrls.get(messageId);
      if (known) return known;
      const message = localMessages.get(messageId);
      if (!client || !message) return null;
      try {
        const url = URL.createObjectURL(await client.loadMedia(message));
        mediaUrls.set(messageId, url);
        void loadMessages(message.conversationId); // swap the preview for the full image
        return url;
      } catch (err: any) {
        set({ error: err?.message ?? 'Attachment could not be opened' });
        return null;
      }
    },

    toggleReaction: (messageId, emoji) => {
      const { activeId, messages } = get();
      const msg = messages[activeId]?.find((m) => m.id === messageId);
      if (!client || !msg) return;
      // One reaction per person: the same emoji again removes it, a different one replaces it.
      const mine = msg.reactions?.find((r) => r.users.includes(CURRENT_USER))?.emoji;
      void client.react(activeId, messageId, mine === emoji ? '' : emoji);
    },

    toggleStarMessage: (messageId) => {
      if (!starred.delete(messageId)) starred.add(messageId);
      void loadMessages(get().activeId);
    },

    togglePinMessage: (messageId) => {
      if (!pinned.delete(messageId)) pinned.add(messageId);
      void loadMessages(get().activeId);
    },

    toggleHuddle: (channelId) => {
      set((state) => {
        if (state.isHuddleActive && state.huddleChannelId === channelId) {
          return { isHuddleActive: false, huddleChannelId: null };
        }
        return { isHuddleActive: true, huddleChannelId: channelId };
      });
    },

    setActiveThreadMessage: (message) => set({ activeThreadMessage: message }),

    createChannel: async (name, topic, isPrivate) => {
      if (!client) return;
      const cleanName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      try {
        // A public channel includes every colleague; a private one starts with only its creator.
        const memberIds = isPrivate ? [] : [...people.keys()].filter((id) => id !== client!.userId);
        const conv = await client.createConversation('channel', memberIds, cleanName, topic, isPrivate);
        set({ activeId: conv.id, activeType: 'channel', isCreateChannelModalOpen: false });
        rebuild();
        await loadMessages(conv.id);
      } catch (err: any) {
        set({ error: err?.message ?? 'Channel could not be created' });
      }
    },

    setCreateChannelModalOpen: (open) => set({ isCreateChannelModalOpen: open }),
    setMentionTaskModalOpen: (open) => set({ isMentionTaskModalOpen: open }),
  };
});
