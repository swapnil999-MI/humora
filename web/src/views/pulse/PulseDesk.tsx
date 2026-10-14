import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  Hash,
  Plus,
  Search,
  Paperclip,
  Smile,
  Send,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Clock,
  X,
  Download,
  MessageSquare,
  Mic,
  Play,
  Pause,
  Pin,
  Reply,
  Check,
  CheckCheck,
  MoreVertical,
  Copy,
  ArrowLeft,
  Camera,
  Video,
  ChevronDown,
  Star,
  StarOff,
  PinOff,
  Pencil,
  Trash2,
  Plus as PlusIcon,
  Lock,
} from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import {
  usePulseStore,
  PulseAttachment,
  PulseTaskTag,
  PulseMemberView,
  PulseTick,
  PulseMessage,
  PulseReplyPreview,
} from '../../store/pulseStore';
import {
  useAuthStore,
} from '../../store/authStore';
import {
  useWorkStore,
} from '../../store/workStore';
import {
  useFusionStore,
} from '../../store/fusionStore';
import {
  api,
} from '../../api/client';
import type { Issue } from '../../types';
import {
  useUiStore,
} from '../../store/uiStore';

type GroupMember = PulseMemberView;

// WhatsApp-style delivery state of an outgoing message.
const MessageTick: React.FC<{ tick?: PulseTick; size?: number }> = ({ tick, size = 13 }) => {
  switch (tick) {
    case 'pending':
      return <Clock size={size - 2} color="var(--text-muted)" />;
    case 'failed':
      return <AlertCircle size={size} color="var(--accent-danger, #ef4444)" />;
    case 'sent':
      return <Check size={size} color="var(--text-muted)" />;
    case 'delivered':
      return <CheckCheck size={size} color="var(--text-muted)" />;
    case 'read':
      return <CheckCheck size={size} color="var(--accent-primary)" />;
    default:
      return null;
  }
};

// Group sender names and quotes use a stable colour per person, as in WhatsApp.
const SENDER_COLORS = ['#1fa2d6', '#d99a06', '#c050d8', '#20a464', '#e2643c', '#5b6ee8'];
const OWN_QUOTE_COLOR = '#11a683';

function senderColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
}

/** Builds the composer quote for a message the user is replying to. */
function replyPreviewOf(msg: PulseMessage): PulseReplyPreview {
  const att = msg.attachments?.[0];
  const kind: PulseReplyPreview['kind'] = msg.voiceNote
    ? 'voice'
    : att?.type === 'image'
      ? 'image'
      : att
        ? 'document'
        : 'text';
  const body = msg.content.replace(/\s+/g, ' ').trim();
  const isMe = msg.senderId === 'user-current';
  return {
    messageId: msg.id,
    senderId: msg.senderId,
    senderName: isMe ? 'You' : (msg.senderName || 'Colleague'),
    isMe,
    text:
      body ||
      (kind === 'voice' ? `Voice message (${msg.voiceNote?.duration ?? '0:00'})` : kind === 'image' ? 'Photo' : att?.name || ''),
    kind,
    thumbnailUrl: kind === 'image' ? att?.previewUrl : undefined,
    unavailable: false,
  };
}

const QUOTE_ICONS: Partial<Record<PulseReplyPreview['kind'], React.ReactNode>> = {
  image: <Camera size={13} />,
  video: <Video size={13} />,
  voice: <Mic size={13} />,
  document: <FileText size={13} />,
};

/** The quoted message: coloured bar and name, one-line snippet, photo thumbnail on the right. */
const ReplyQuote: React.FC<{ preview: PulseReplyPreview; onClick?: () => void }> = ({ preview, onClick }) => {
  const accent = preview.isMe ? OWN_QUOTE_COLOR : preview.senderId ? senderColor(preview.senderId) : 'var(--text-muted)';
  const content = (
    <>
      <span className="pulse-quote-bar" style={{ background: accent }} />
      <span className="pulse-quote-body">
        {preview.senderName && (
          <span className="pulse-quote-name" style={{ color: accent }}>
            {preview.senderName}
          </span>
        )}
        <span className="pulse-quote-text">
          {QUOTE_ICONS[preview.kind]}
          <span>{preview.text}</span>
        </span>
      </span>
      {preview.thumbnailUrl && <img className="pulse-quote-thumb" src={preview.thumbnailUrl} alt="" />}
    </>
  );
  return onClick ? (
    <button type="button" className="pulse-quote" onClick={onClick} title="Go to the original message">
      {content}
    </button>
  ) : (
    <div className="pulse-quote is-static">{content}</div>
  );
};

const MENU_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageMenuProps {
  msg: PulseMessage;
  x: number;
  y: number;
  onClose: () => void;
  onReact: (emoji: string) => void;
  /** Opens the full emoji picker to react with any emoji. */
  onMoreReactions: (x: number, y: number) => void;
  onReply: () => void;
  onCopy: () => void;
  onStar: () => void;
  onPin: () => void;
  onThread: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** WhatsApp Web's message menu: quick reactions on top, then the actions for this message. */
const MessageMenu: React.FC<MessageMenuProps> = ({ msg, x, y, onClose, ...a }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu on screen: open upwards / leftwards when there is no room.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: y + height > window.innerHeight - 8 ? Math.max(8, y - height) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    document.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      document.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const run = (fn?: () => void) => () => {
    onClose();
    fn?.();
  };
  const mine = msg.reactions?.find((r) => r.users.includes('user-current'))?.emoji;
  const item = (icon: React.ReactNode, label: string, fn?: () => void, danger = false) => (
    <button type="button" role="menuitem" className={`pulse-menu-item${danger ? ' is-danger' : ''}`} onClick={run(fn)}>
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div ref={ref} className="pulse-msg-menu" role="menu" style={{ left: pos.left, top: pos.top }} onContextMenu={(e) => e.preventDefault()}>
      <div className="pulse-menu-reactions">
        {MENU_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={mine === emoji ? 'is-mine' : ''}
            onClick={run(() => a.onReact(emoji))}
            aria-label={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          className="pulse-more-reactions"
          title="More reactions"
          aria-label="More reactions"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onClose();
            a.onMoreReactions(r.left, r.bottom + 6);
          }}
        >
          <PlusIcon size={16} />
        </button>
      </div>
      {item(<Reply size={16} />, 'Reply', a.onReply)}
      {msg.content && item(<Copy size={16} />, 'Copy', a.onCopy)}
      {item(msg.isStarred ? <StarOff size={16} /> : <Star size={16} />, msg.isStarred ? 'Unstar' : 'Star', a.onStar)}
      {item(msg.isPinned ? <PinOff size={16} /> : <Pin size={16} />, msg.isPinned ? 'Unpin' : 'Pin', a.onPin)}
      {item(<MessageSquare size={16} />, 'Reply in thread', a.onThread)}
      {a.onDownload && item(<Download size={16} />, 'Download', a.onDownload)}
      {a.onEdit && item(<Pencil size={16} />, 'Edit', a.onEdit)}
      {a.onDelete && item(<Trash2 size={16} />, 'Delete for everyone', a.onDelete, true)}
    </div>
  );
};

export const PulseDesk: React.FC = () => {
  const {
    activeType,
    activeId,
    channels,
    directMessages,
    messages,
    members,
    error: pulseError,
    init: initPulse,
    setViewing,
    sendFile,
    sendVoiceNote,
    openMedia,
    searchQuery,
    isCreateChannelModalOpen,
    isMentionTaskModalOpen,
    activeThreadMessage,
    setActiveConversation,
    setSearchQuery,
    sendMessage,
    toggleReaction,
    toggleStarMessage,
    togglePinMessage,
    editMessage,
    deleteMessage,
    typing,
    notifyTyping,
    setActiveThreadMessage,
    createChannel,
    setCreateChannelModalOpen,
    setMentionTaskModalOpen,
  } = usePulseStore();

  const { setActiveIssue } = useWorkStore();
  const { myWorkday, fetchMyWorkday } = useFusionStore();
  useEffect(() => {
    void fetchMyWorkday();
  }, [fetchMyWorkday]);
  const { addToast } = useUiStore();
  const userId = useAuthStore((state) => state.user?.id);

  // Start the encrypted messaging engine for the signed-in user.
  useEffect(() => {
    if (userId) void initPulse(userId);
  }, [userId, initPulse]);

  // Incoming messages count as read only while this screen is open.
  useEffect(() => {
    setViewing(true);
    return () => setViewing(false);
  }, [setViewing]);

  useEffect(() => {
    if (pulseError) addToast({ type: 'error', message: pulseError });
  }, [pulseError, addToast]);

  const copyMessageText = (text: string) => {
    const copied = () => addToast({ type: 'success', message: 'Message copied' });
    const failed = () => addToast({ type: 'error', message: 'Could not copy: the browser blocked clipboard access.' });
    // The Clipboard API only exists on https or localhost; a LAN install on plain http needs the old way.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(copied, failed);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      if (document.execCommand('copy')) copied();
      else failed();
    } catch {
      failed();
    } finally {
      area.remove();
    }
  };

  // Local state for message input
  const [inputText, setInputText] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState<PulseAttachment[]>([]);
  const [stagedTaskTags, setStagedTaskTags] = useState<PulseTaskTag[]>([]);
  // Full emoji picker: for the message box, or to react to one message with any emoji.
  const [emojiPicker, setEmojiPicker] = useState<{ mode: 'compose' | 'react'; messageId?: string; x: number; y: number } | null>(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  // WhatsApp-style quoted reply being composed, and the message flashed after jumping to it.
  const [replyingTo, setReplyingTo] = useState<PulseReplyPreview | null>(null);
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null);
  // Right-click / chevron menu, message being edited, and delete confirmation.
  const [messageMenu, setMessageMenu] = useState<{ msg: PulseMessage; x: number; y: number } | null>(null);
  const [editingMessage, setEditingMessage] = useState<PulseMessage | null>(null);
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<PulseMessage | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const swipeRef = useRef<{
    id: string;
    x: number;
    y: number;
    dx: number;
    el: HTMLElement;
    isMe: boolean;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);

  // WhatsApp-Style Filter Pills (All, Unread, Groups, Direct)
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'groups' | 'dms'>('all');

  // WhatsApp-Style In-Chat Search Overlay
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');

  // WhatsApp-Style Three-Dot Menus
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);
  const [isChatHeaderMenuOpen, setIsChatHeaderMenuOpen] = useState(false);

  // WhatsApp-Style Info Drawer (Group Info or Contact Info)
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [isPinnedDrawerOpen, setIsPinnedDrawerOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Voice-note playback
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceElapsedSec, setVoiceElapsedSec] = useState(0);

  // Thread discussion drawer
  const [threadInputText, setThreadInputText] = useState('');

  // Group creation modal state
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [isNewChannelPrivate, setIsNewChannelPrivate] = useState(false);

  // File input ref for attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll message stream to bottom
  // Phones show one pane at a time: the chat list, or the open conversation (CSS in index.css).
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');

  const currentMessages = messages[activeId] || [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, activeId]);

  // Voice note playback and recording
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<{ recorder: MediaRecorder; startedAt: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const stopVoicePlayback = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingVoiceId(null);
  };

  const handleToggleVoicePlayback = async (messageId: string) => {
    if (playingVoiceId === messageId) {
      stopVoicePlayback();
      return;
    }
    stopVoicePlayback();
    const url = await openMedia(messageId);
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.ontimeupdate = () => setVoiceElapsedSec(audio.currentTime);
    audio.onended = stopVoicePlayback;
    setVoiceElapsedSec(0);
    setPlayingVoiceId(messageId);
    void audio.play().catch(stopVoicePlayback);
  };

  // Stop audio and release the microphone when leaving the screen.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      recorderRef.current?.recorder.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  // Determine active conversation details
  const activeChannel = channels.find((c) => c.id === activeId);
  const activeDM = directMessages.find((dm) => dm.id === activeId);
  const hasActiveChat = Boolean(activeChannel || activeDM);

  // Sync mobile chat view class for full-screen phone UX
  useEffect(() => {
    if (mobilePane === 'chat') {
      document.body.classList.add('mobile-chat-open');
    } else {
      document.body.classList.remove('mobile-chat-open');
    }
    return () => {
      document.body.classList.remove('mobile-chat-open');
    };
  }, [mobilePane]);

  const currentGroupMembers: GroupMember[] = members[activeId] || [];

  const filteredGroupMembers = currentGroupMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  // Tasks the user can tag: their own focus tasks from the Work module.
  const availableSprintTasks: PulseTaskTag[] = (myWorkday?.focus_tasks ?? []).map((t) => ({
    id: t.id,
    key: t.issue_key,
    title: t.title,
    status: t.status_category === 'done' ? 'done' : t.status_category === 'in_progress' ? 'in_progress' : 'todo',
    priority: (['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium') as PulseTaskTag['priority'],
    assigneeName: myWorkday?.employee_name ?? '',
    assignedByManager: '',
    storyPoints: t.story_points,
  }));

  const filteredSprintTasks = availableSprintTasks.filter(
    (t) =>
      t.key.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      t.assigneeName.toLowerCase().includes(taskSearchQuery.toLowerCase())
  );

  // Filter Conversations for WhatsApp Left Sidebar
  const combinedConversations = [
    ...channels.map((c) => ({ ...c, isGroup: true })),
    ...directMessages.map((d) => ({ ...d, isGroup: false })),
  ];

  const filteredConversations = combinedConversations.filter((item) => {
    // Search query filter
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((item as any).topic && (item as any).topic.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ((item as any).role && (item as any).role.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Filter pill tabs
    if (chatFilter === 'unread') return item.unreadCount > 0;
    if (chatFilter === 'groups') return item.isGroup;
    if (chatFilter === 'dms') return !item.isGroup;
    return true;
  });

  // Filter messages in stream for In-Chat Search
  const threadRepliesOf = (rootId: string) => currentMessages.filter((m) => m.threadRootId === rootId);
  // Thread replies live in the thread drawer, not the main timeline.
  const timelineMessages = currentMessages.filter((m) => !m.threadRootId);
  const displayMessages = inChatSearchQuery.trim()
    ? timelineMessages.filter((m) =>
        m.content.toLowerCase().includes(inChatSearchQuery.toLowerCase())
      )
    : timelineMessages;

  // Replying: the quote sits above the composer and the cursor goes to the field (WhatsApp).
  const startReply = (msg: PulseMessage) => {
    if (msg.isDeleted || msg.isUnavailable) return;
    if (editingMessage) cancelEdit();
    setReplyingTo(replyPreviewOf(msg));
    setActiveThreadMessage(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  useEffect(() => {
    setReplyingTo(null);
    setEditingMessage(null);
    setMessageMenu(null);
    setEmojiPicker(null);
  }, [activeId]);

  const openMessageMenu = (msg: PulseMessage, x: number, y: number) => {
    if (msg.isDeleted || msg.isUnavailable) return;
    setMessageMenu({ msg, x, y });
  };

  const startEdit = (msg: PulseMessage) => {
    setReplyingTo(null);
    setEditingMessage(msg);
    setInputText(msg.content);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  // Puts an emoji at the caret in the message box (replacing any selection), like WhatsApp.
  const insertEmoji = (emoji: string) => {
    const ta = composerRef.current;
    const start = ta?.selectionStart ?? inputText.length;
    const end = ta?.selectionEnd ?? start;
    setInputText(inputText.slice(0, start) + emoji + inputText.slice(end));
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  // Tapping a quote scrolls to the original and flashes it.
  const jumpToMessage = (messageId: string) => {
    const el = document.getElementById(`pulse-msg-${messageId}`);
    if (!el) {
      addToast({ type: 'info', message: 'The original message is not in this view.' });
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashMessageId(null);
    requestAnimationFrame(() => setFlashMessageId(messageId));
    window.setTimeout(() => setFlashMessageId((cur) => (cur === messageId ? null : cur)), 1500);
  };

  // Touch screens: swipe a message to reply (swipe right for incoming, swipe left or right for own message),
  // and long-press (500ms) to open the message menu with Reply.
  const onRowTouchStart = (msg: PulseMessage, e: React.TouchEvent<HTMLDivElement>) => {
    if (msg.isDeleted || msg.isUnavailable) return;
    const t = e.touches[0];
    const isMe = msg.senderId === 'user-current';
    const targetEl = e.currentTarget;

    const timer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(20);
      const r = targetEl.getBoundingClientRect();
      openMessageMenu(msg, isMe ? Math.max(12, r.right - 200) : Math.max(12, r.left), r.bottom + 4);
    }, 500);

    swipeRef.current = { id: msg.id, x: t.clientX, y: t.clientY, dx: 0, el: targetEl, isMe, timer };
  };
  const onRowTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const sw = swipeRef.current;
    if (!sw) return;
    const t = e.touches[0];
    const dx = t.clientX - sw.x;
    const dy = t.clientY - sw.y;

    if (Math.abs(dy) > 10 || Math.abs(dx) > 10) {
      if (sw.timer) {
        clearTimeout(sw.timer);
        sw.timer = undefined;
      }
    }

    if (Math.abs(dy) > 30 && Math.abs(sw.dx) < 10) {
      swipeRef.current = null; // vertical scroll, not a swipe
      sw.el.style.transform = '';
      return;
    }

    // Allow swipe left or right on own message; swipe right on incoming
    if (sw.isMe) {
      sw.dx = dx < 0 ? Math.max(-75, dx) : Math.min(75, dx);
    } else {
      sw.dx = Math.max(0, Math.min(75, dx));
    }
    sw.el.style.transform = `translateX(${sw.dx}px)`;
    sw.el.style.transition = 'none';
  };
  const onRowTouchEnd = (msg: PulseMessage) => {
    const sw = swipeRef.current;
    if (sw?.timer) {
      clearTimeout(sw.timer);
    }
    swipeRef.current = null;
    if (!sw) return;
    sw.el.style.transition = 'transform 0.2s ease-out';
    sw.el.style.transform = '';
    if (Math.abs(sw.dx) >= 42) {
      if (navigator.vibrate) navigator.vibrate(15);
      startReply(msg);
    }
  };

  // Send message handler
  const handleSend = () => {
    if (editingMessage) {
      if (inputText.trim() && inputText.trim() !== editingMessage.content) void editMessage(editingMessage.id, inputText);
      cancelEdit();
      return;
    }
    if (!inputText.trim() && stagedAttachments.length === 0 && stagedTaskTags.length === 0) return;

    if (!inputText.trim()) {
      addToast({ type: 'info', message: 'Type a message to send with the tagged task.' });
      return;
    }
    // The task picker still lists sample tasks; only tags that point at a real task can be sent.
    if (stagedTaskTags.some((t) => !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t.id))) {
      addToast({ type: 'info', message: 'That tag does not point at a task you can access, so the message was sent without it.' });
    }
    sendMessage(activeId, inputText, stagedAttachments, stagedTaskTags, undefined, { replyToId: replyingTo?.messageId });
    setReplyingTo(null);
    setInputText('');
    setStagedAttachments([]);
    setStagedTaskTags([]);
    setIsAttachMenuOpen(false);
  };

  // Keyboard shortcut in message textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && (replyingTo || editingMessage)) {
      e.preventDefault();
      if (editingMessage) cancelEdit();
      else setReplyingTo(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Encrypt and send the chosen file straight away.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setIsAttachMenuOpen(false);
    if (!file) return;
    addToast({ type: 'info', message: `Encrypting and sending "${file.name}"...` });
    const replyToId = replyingTo?.messageId;
    setReplyingTo(null);
    if (await sendFile(activeId, file, { replyToId })) addToast({ type: 'success', message: `Sent "${file.name}".` });
  };

  // Decrypt an attachment and either save it or open it in a new tab.
  const handleOpenAttachment = async (att: PulseAttachment, download: boolean) => {
    const url = await openMedia(att.id);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    if (download) link.download = att.name;
    else link.target = '_blank';
    link.click();
  };

  // Stage a tagged task
  const handleStageTask = (task: PulseTaskTag) => {
    if (!stagedTaskTags.some((t) => t.id === task.id)) {
      setStagedTaskTags((prev) => [...prev, task]);
      addToast({ type: 'success', message: `Tagged task #${task.key} in conversation.` });
    }
    setMentionTaskModalOpen(false);
    setTaskSearchQuery('');
  };

  // Mic button: first press starts recording, second press stops and sends.
  const handleRecordAudioMemo = async () => {
    const active = recorderRef.current;
    if (active) {
      active.recorder.stop();
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      addToast({ type: 'error', message: 'Microphone access was not allowed.' });
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const conversationId = activeId;
    const replyToId = replyingTo?.messageId;
    setReplyingTo(null);
    const startedAt = Date.now();
    recorder.ondataavailable = (ev) => chunks.push(ev.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      setIsRecording(false);
      const recording = new Blob(chunks, { type: recorder.mimeType });
      if (recording.size === 0) return;
      if (await sendVoiceNote(conversationId, recording, Date.now() - startedAt, { replyToId })) {
        addToast({ type: 'success', message: '🎙️ Voice note sent.' });
      }
    };
    recorderRef.current = { recorder, startedAt };
    recorder.start();
    setIsRecording(true);
    addToast({ type: 'info', message: 'Recording... press the mic again to send.' });
  };

  // WhatsApp UX: Direct Message a Member
  const handleDirectMessageMember = (member: GroupMember) => {
    setIsInfoDrawerOpen(false);
    if (member.dmId) {
      setActiveConversation(member.dmId, 'dm');
      setMobilePane('chat');
    }
  };

  // Create Channel/Group submission
  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    createChannel(newChannelName, newChannelTopic, isNewChannelPrivate);
    setNewChannelName('');
    setNewChannelTopic('');
    setIsNewChannelPrivate(false);
    addToast({ type: 'success', message: `Created group #${newChannelName}.` });
  };

  // A tagged task opens the live issue in the Work module's drawer.
  const openTaskIssue = async (task: PulseTaskTag) => {
    try {
      setActiveIssue(await api.get<Issue>(`/work/issues/${task.id}`));
    } catch {
      addToast({ type: 'error', message: `${task.key} could not be opened. You may not have access to it.` });
    }
  };

  // Thread replies are ordinary encrypted messages that name their thread root.
  const handleSendThreadReply = () => {
    if (!activeThreadMessage || !threadInputText.trim()) return;
    void sendMessage(activeId, threadInputText, [], [], undefined, { threadRootId: activeThreadMessage.id });
    setThreadInputText('');
  };

  return (
    <div
      className="pulse-desk"
      data-mobile-pane={mobilePane}
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--surface-0)',
        position: 'relative',
      }}
    >
      {/* Subtle Luxury Ambient Radial Glows */}
      <div
        className="pulse-ambient-glow"
        style={{
          top: '-10%',
          right: '20%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.05) 0%, transparent 70%)',
        }}
      />


      {/* ========================================================================= */}
      {/* 1. WHATSAPP WEB STYLE LEFT SIDEBAR: CHATS LIST & FILTER PILLS             */}
      {/* ========================================================================= */}
      <aside
        className="pulse-list"
        style={{
          width: '340px',
          borderRight: '1px solid var(--border-hairline)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        {/* WhatsApp Top Profile & Actions Header */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-2)',
          }}
        >
          {/* User Profile Avatar with Status Ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#000000',
                  fontWeight: 800,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                YOU
              </div>
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid var(--surface-2)',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Chats
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Humora Team Pulse
              </span>
            </div>
          </div>

          {/* Right Action Icons (New Group, Menu) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>

            <button
              onClick={() => setCreateChannelModalOpen(true)}
              className="btn btn-ghost"
              style={{ padding: '7px', borderRadius: '50%', color: 'var(--text-muted)' }}
              title="New Group Chat"
            >
              <Plus size={19} />
            </button>

            <button
              onClick={() => setIsSidebarMenuOpen((p) => !p)}
              className="btn btn-ghost"
              style={{ padding: '7px', borderRadius: '50%', color: 'var(--text-muted)' }}
              title="Menu"
            >
              <MoreVertical size={18} />
            </button>

            {/* Sidebar Menu Popover */}
            {isSidebarMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  width: '180px',
                  background: 'var(--surface-3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-popover)',
                  padding: '6px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <button
                  onClick={() => {
                    setIsSidebarMenuOpen(false);
                    setCreateChannelModalOpen(true);
                  }}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
                >
                  New Group
                </button>
                <button
                  onClick={() => {
                    setIsSidebarMenuOpen(false);
                    setIsPinnedDrawerOpen(true);
                  }}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
                >
                  Starred & Pinned
                </button>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Search Bar */}
        <div style={{ padding: '10px 12px 6px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 12px',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search or start a new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '100%',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* WhatsApp Filter Pills: All | Unread | Groups | Direct */}
        <div style={{ padding: '4px 12px 10px', display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-hairline)' }}>
          {(['all', 'unread', 'groups', 'dms'] as const).map((filterKey) => {
            const isActive = chatFilter === filterKey;
            const labels = { all: 'All', unread: 'Unread', groups: 'Groups', dms: 'Direct' };

            return (
              <button
                key={filterKey}
                onClick={() => setChatFilter(filterKey)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive
                    ? '1px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                  background: isActive ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-2)',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {labels[filterKey]}
              </button>
            );
          })}
        </div>

        {/* WhatsApp Scrollable Conversations Roster */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Search size={22} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {searchQuery ? 'No chats found' : 'No conversations yet'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '220px', lineHeight: 1.5 }}>
                {searchQuery
                  ? `No results match "${searchQuery}". Check spelling or start a new chat.`
                  : 'Start chatting with your team or create a new group channel.'}
              </div>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setCreateChannelModalOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '8px', gap: '6px' }}
                >
                  <Plus size={14} />
                  <span>Create Group</span>
                </button>
              )}
            </div>
          ) : (
            filteredConversations.map((item) => {
            const isGroup = item.isGroup;
            const isActive = isGroup
              ? activeType === 'channel' && activeId === item.id
              : activeType === 'dm' && activeId === item.id;

            const timeDisplay = item.lastMessageTime || '';

            const snippet =
              item.lastMessageSnippet || (isGroup ? (item as any).topic : (item as any).role) || '';

            return (
              <div
                key={item.id}
                onClick={() => {
                  setActiveConversation(item.id, isGroup ? 'channel' : 'dm');
                  setMobilePane('chat');
                }}
                className={`pulse-channel-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-hairline)',
                  background: isActive ? 'var(--surface-3)' : 'transparent',
                  transition: 'background var(--transition-fast)',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                }}
              >
                {/* 48px Circular Avatar with Online Presence */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: isGroup
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.12) 100%)'
                        : 'var(--surface-4)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary)',
                      fontWeight: 700,
                      fontSize: '15px',
                    }}
                  >
                    {isGroup ? <Hash size={22} /> : item.name.charAt(0)}
                  </div>

                  {!isGroup && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '11px',
                        height: '11px',
                        borderRadius: '50%',
                        background: (item as any).status === 'online' ? '#10b981' : '#f59e0b',
                        border: '2px solid var(--surface-1)',
                      }}
                    />
                  )}
                </div>

                {/* Name, Snippet & Timestamp Column */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {timeDisplay}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                      {/* Delivery state of the last message, when it is the user's own */}
                      {item.lastMessageTick && (
                        <span style={{ display: 'flex', flexShrink: 0 }}>
                          <MessageTick tick={item.lastMessageTick} size={14} />
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {snippet}
                      </span>
                    </div>

                    {item.unreadCount > 0 && (
                      <span
                        style={{
                          background: 'var(--accent-primary)',
                          color: '#000000',
                          fontWeight: 700,
                          fontSize: '10px',
                          padding: '1px 7px',
                          borderRadius: '10px',
                          flexShrink: 0,
                        }}
                      >
                        {item.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN ACTIVE CONVERSATION CANVAS (WHATSAPP WEB UX)                     */}
      {/* ========================================================================= */}
      <main
        className="pulse-chat"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {!hasActiveChat ? (
          <div
            className="whatsapp-welcome-view"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-0)',
              padding: '40px 24px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '420px',
                height: '420px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.07) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.08) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                marginBottom: '22px',
                boxShadow: '0 8px 32px rgba(245, 158, 11, 0.12)',
              }}
            >
              <MessageSquare size={40} strokeWidth={1.75} />
            </div>

            <h2
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '10px',
                letterSpacing: '-0.02em',
              }}
            >
              Humora Pulse for Web
            </h2>

            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                maxWidth: '420px',
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              Send and receive end-to-end encrypted messages, voice notes, and project task tags with your team seamlessly.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                background: 'var(--surface-2)',
                padding: '6px 16px',
                borderRadius: '20px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Lock size={12} color="var(--accent-primary)" />
              <span>End-to-end encrypted</span>
            </div>
          </div>
        ) : (
          <>
        {/* WhatsApp Chat Top Navigation Header */}
        <header
          className="pulse-chat-header"
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-hairline)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
          }}
        >
          {/* Phones: back to the chat list. */}
          <button
            type="button"
            className="btn btn-ghost mobile-only"
            onClick={() => setMobilePane('list')}
            aria-label="Back to chats"
            title="Back to chats"
            style={{ padding: '6px', marginRight: '4px', flexShrink: 0 }}
          >
            <ArrowLeft size={18} />
          </button>
          {/* Left Avatar & Clickable Info Area */}
          <div
            onClick={() => setIsInfoDrawerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            title="Click for Contact / Group Info"
          >
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: activeType === 'channel' ? 'var(--accent-primary-subtle)' : 'var(--surface-3)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  fontSize: '15px',
                }}
              >
                {activeType === 'channel' ? <Hash size={20} /> : activeDM?.name.charAt(0) || 'U'}
              </div>
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid var(--surface-2)',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeChannel ? `#${activeChannel.name}` : activeDM?.name || 'Pulse'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {activeType === 'channel'
                  ? currentGroupMembers.map((m) => m.name).join(', ')
                  : activeDM?.role || ''}
              </div>
            </div>
          </div>

          {/* Right Action Icons: Video, Voice Call, In-Chat Search, Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            {/* In-Chat Search Trigger */}
            <button
              onClick={() => setIsChatSearchOpen((p) => !p)}
              className="btn btn-ghost"
              style={{
                padding: '8px',
                borderRadius: '50%',
                color: isChatSearchOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
              title="Search in chat"
            >
              <Search size={18} />
            </button>

            {/* Three-Dot Chat Options Menu */}
            <button
              onClick={() => setIsChatHeaderMenuOpen((p) => !p)}
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: '50%', color: 'var(--text-muted)' }}
              title="More options"
            >
              <MoreVertical size={18} />
            </button>

            {/* Header Menu Dropdown */}
            {isChatHeaderMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  width: '200px',
                  background: 'var(--surface-3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-popover)',
                  padding: '6px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <button
                  onClick={() => {
                    setIsChatHeaderMenuOpen(false);
                    setIsInfoDrawerOpen(true);
                  }}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
                >
                  {activeType === 'channel' ? 'Group Info' : 'Contact Info'}
                </button>
                <button
                  onClick={() => {
                    setIsChatHeaderMenuOpen(false);
                    setIsPinnedDrawerOpen(true);
                  }}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
                >
                  Starred & Pinned
                </button>
              </div>
            )}
          </div>
        </header>

        {/* WhatsApp In-Chat Search Overlay Banner */}
        {isChatSearchOpen && (
          <div
            style={{
              padding: '8px 20px',
              background: 'var(--surface-3)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <Search size={14} color="var(--accent-primary)" />
            <input
              type="text"
              autoFocus
              placeholder="Search in conversation..."
              value={inChatSearchQuery}
              onChange={(e) => setInChatSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {inChatSearchQuery && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {displayMessages.length} matches
              </span>
            )}
            <button
              onClick={() => {
                setIsChatSearchOpen(false);
                setInChatSearchQuery('');
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. CHAT STREAM CANVAS WITH WHATSAPP BUBBLE STYLING                        */}
        {/* ========================================================================= */}
        <div
          className="whatsapp-chat-canvas"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Render Messages in WhatsApp Bubbles */}
          {displayMessages.map((msg, index) => {
            const day = new Date(msg.createdAt).toDateString();
            const showDay = index === 0 || new Date(displayMessages[index - 1].createdAt).toDateString() !== day;
            const isMe = msg.senderId === 'user-current';
            const isHovered = hoveredMessageId === msg.id;
            const replies = threadRepliesOf(msg.id);

            return (
              <React.Fragment key={msg.id}>
              {showDay && (
                <div className="whatsapp-date-pill">
                  {day === new Date().toDateString()
                    ? 'TODAY'
                    : day === new Date(Date.now() - 86400000).toDateString()
                      ? 'YESTERDAY'
                      : new Date(msg.createdAt).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
                </div>
              )}
              <div
                key={msg.id}
                id={`pulse-msg-${msg.id}`}
                className={`pulse-msg-row ${isMe ? 'msg-out' : 'msg-in'}${flashMessageId === msg.id ? ' pulse-msg-flash' : ''}`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                onContextMenu={(e) => {
                  if (msg.isDeleted || msg.isUnavailable) return;
                  e.preventDefault();
                  openMessageMenu(msg, e.clientX, e.clientY);
                }}
                onDoubleClick={() => startReply(msg)}
                onTouchStart={(e) => onRowTouchStart(msg, e)}
                onTouchMove={onRowTouchMove}
                onTouchEnd={() => onRowTouchEnd(msg)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  margin: '4px 0',
                  marginRight: isMe ? '10px' : '0',
                  marginLeft: !isMe ? '10px' : '0',
                }}
              >
                {/* WhatsApp-style quick reply arrow beside the bubble */}
                {isHovered && !msg.isDeleted && !msg.isUnavailable && (
                  <button
                    type="button"
                    className="pulse-quick-reply"
                    style={{ [isMe ? 'left' : 'right']: '-32px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startReply(msg);
                    }}
                    title="Reply (or double-click message)"
                    aria-label="Reply"
                  >
                    <Reply size={15} />
                  </button>
                )}

                {/* Floating quick reactions on hover (the rest is in the message menu) */}
                {isHovered && !msg.isDeleted && !msg.isUnavailable && (
                  <div
                    className="whatsapp-reaction-bar"
                    style={{
                      position: 'absolute',
                      top: '-18px',
                      [isMe ? 'left' : 'right']: '0px',
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '16px',
                      padding: '2px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: 'var(--shadow-md)',
                      zIndex: 20,
                    }}
                  >
                    {MENU_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => toggleReaction(msg.id, emoji, 'user-current')}
                        className="reaction-emoji-btn"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                        aria-label={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setEmojiPicker({ mode: 'react', messageId: msg.id, x: r.left, y: r.bottom + 6 });
                      }}
                      className="reaction-emoji-btn"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0 2px' }}
                      title="More reactions"
                      aria-label="More reactions"
                    >
                      <PlusIcon size={14} />
                    </button>
                  </div>
                )}

                {/* Message Bubble Card */}
                <div
                  className={isMe ? 'whatsapp-bubble-out' : 'whatsapp-bubble-in'}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startReply(msg);
                  }}
                  title="Double-click to reply"
                  style={{
                    padding: '8px 12px',
                    position: 'relative',
                    cursor: 'default',
                  }}
                >
                  {/* WhatsApp Web chevron: opens the message menu */}
                  {!msg.isDeleted && !msg.isUnavailable && (
                    <button
                      type="button"
                      className={`pulse-bubble-chevron ${isHovered ? 'is-visible' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        openMessageMenu(msg, isMe ? Math.max(12, r.right - 200) : Math.max(12, r.left), r.bottom + 4);
                      }}
                      title="Message options"
                      aria-label="Message options"
                    >
                      <ChevronDown size={15} />
                    </button>
                  )}
                  {/* WhatsApp Top Triangular Corner Notch / Tail with continuous border */}
                  {isMe ? (
                    <span className="whatsapp-tail-out" aria-hidden="true">
                      <svg viewBox="-1 0 9 13" width="9" height="13" style={{ display: 'block', overflow: 'visible' }}>
                        <path
                          className="tail-fill"
                          d="M -1 0 H 5.188 C 6.958 0 7.526 1.156 6.467 2.568 L 0 11.193 L -1 11.193 Z"
                        />
                        <path
                          className="tail-stroke"
                          fill="none"
                          d="M -1 0.5 H 5.188 C 6.958 0.5 7.526 1.156 6.467 2.568 L 0 11.193"
                        />
                      </svg>
                    </span>
                  ) : (
                    <span className="whatsapp-tail-in" aria-hidden="true">
                      <svg viewBox="0 0 9 13" width="9" height="13" style={{ display: 'block', overflow: 'visible' }}>
                        <path
                          className="tail-fill"
                          d="M 9 0 H 2.812 C 1.042 0 0.474 1.156 1.533 2.568 L 8 11.193 L 9 11.193 Z"
                        />
                        <path
                          className="tail-stroke"
                          fill="none"
                          d="M 9 0.5 H 2.812 C 1.042 0.5 0.474 1.156 1.533 2.568 L 8 11.193"
                        />
                      </svg>
                    </span>
                  )}
                  {/* Sender Name in Group Chats for incoming messages */}
                  {!isMe && activeType === 'channel' && (
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: senderColor(msg.senderId),
                        marginBottom: '3px',
                      }}
                    >
                      {msg.senderName}
                    </div>
                  )}

                  {/* Quoted message this one replies to (tap to jump to it) */}
                  {msg.replyTo && !msg.isDeleted && (
                    <ReplyQuote preview={msg.replyTo} onClick={msg.replyTo.unavailable ? undefined : () => jumpToMessage(msg.replyTo!.messageId)} />
                  )}

                  {/* Text Content */}
                  {msg.content && (
                    <div
                      style={{
                        fontSize: '13px',
                        lineHeight: 1.45,
                        color: 'var(--text-primary)',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        // The app shell disables selection; message text must stay selectable.
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        cursor: 'text',
                      }}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* WhatsApp-Style Voice Note Waveform Player */}
                  {msg.voiceNote && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '4px 0',
                        minWidth: '240px',
                      }}
                    >
                      <button
                        onClick={() => handleToggleVoicePlayback(msg.id)}
                        className={`voice-play-btn ${playingVoiceId === msg.id ? 'is-active' : ''}`}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--accent-primary)',
                          border: 'none',
                          color: '#000000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {playingVoiceId === msg.id ? <Pause size={14} /> : <Play size={14} />}
                      </button>

                      {/* Scrubber Waveform */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: '20px' }}>
                        {msg.voiceNote.waveform.map((val, idx) => {
                          const isPlayed =
                            playingVoiceId === msg.id
                              ? idx / msg.voiceNote!.waveform.length <= voiceElapsedSec / (msg.voiceNote!.durationSec || 1)
                              : false;

                          return (
                            <div
                              key={idx}
                              className={`waveform-bar ${playingVoiceId === msg.id ? 'is-playing' : ''}`}
                              style={{
                                flex: 1,
                                height: `${Math.max(10, (val / 100) * 20)}px`,
                                borderRadius: '1px',
                                background: isPlayed ? 'var(--accent-primary)' : 'var(--border-strong)',
                              }}
                            />
                          );
                        })}
                      </div>

                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {playingVoiceId === msg.id
                          ? `${Math.floor(voiceElapsedSec / 60)}:${Math.floor(voiceElapsedSec % 60).toString().padStart(2, '0')}`
                          : msg.voiceNote.duration}
                      </span>
                    </div>
                  )}

                  {/* Tagged tasks: a label snapshot; opening one loads the live issue */}
                  {msg.taggedTasks && msg.taggedTasks.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {msg.taggedTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="whatsapp-task-card"
                          onClick={() => void openTaskIssue(task)}
                          style={{ textAlign: 'left', cursor: 'pointer' }}
                          title="Open in Work"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)' }}>{task.key}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', marginTop: '2px' }}>{task.title}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {replies.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveThreadMessage(msg)}
                      className="btn btn-ghost"
                      style={{ marginTop: '6px', padding: '2px 8px', fontSize: '11px', color: 'var(--accent-primary)' }}
                    >
                      {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                    </button>
                  )}

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {msg.attachments.map((att) => (
                        <React.Fragment key={att.id}>
                        {att.previewUrl && (
                          <img
                            src={att.previewUrl}
                            alt={att.name}
                            onClick={() => handleOpenAttachment(att, false)}
                            style={{ maxWidth: '260px', maxHeight: '260px', width: att.url ? 'auto' : '160px', borderRadius: '6px', cursor: 'pointer', objectFit: 'cover' }}
                          />
                        )}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'var(--surface-3)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            <FileText size={14} color="var(--accent-primary)" />
                            <span style={{ fontSize: '11px', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {att.name}
                            </span>
                          </div>
                          <button
                            onClick={() => handleOpenAttachment(att, true)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0 }}
                          >
                            <Download size={12} />
                          </button>
                        </div>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Bottom Info Row: Timestamp + WhatsApp Double Checkmark (✓✓) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      marginTop: '4px',
                    }}
                  >
                    {msg.isPinned && <Pin size={10} color="var(--text-muted)" aria-label="Pinned" />}
                    {msg.isStarred && <Star size={10} color="var(--text-muted)" fill="currentColor" aria-label="Starred" />}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {msg.timestamp}
                    </span>

                    {msg.isEdited && !msg.isDeleted && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>edited</span>
                    )}

                    {/* One tick: stored. Two ticks: delivered. Blue ticks: read. */}
                    {isMe && (
                      <span className="receipt-checkmarks">
                        <MessageTick tick={msg.tick} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Overlapping Reaction Tag Pill (WhatsApp Style) */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div
                    className="whatsapp-reaction-pill"
                    style={{
                      position: 'absolute',
                      bottom: '-8px',
                      [isMe ? 'right' : 'left']: '8px',
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: '12px',
                      padding: '1px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      boxShadow: 'var(--shadow-xs)',
                      zIndex: 5,
                    }}
                  >
                    {msg.reactions.map((r, i) => (
                      <span key={i}>
                        {r.emoji} {r.count > 1 ? r.count : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              </React.Fragment>
            );
          })}

          {/* Live typing indicator (from the other members' devices) */}
          {(typing[activeId]?.length ?? 0) > 0 && (
            <div
              className="pulse-typing-indicator"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                alignSelf: 'flex-start',
                margin: '2px 8px 6px',
                padding: '5px 12px',
                borderRadius: '16px',
                background: 'var(--clay-surface)',
                border: '1px solid var(--border-hairline)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {typing[activeId].length === 1
                  ? `${typing[activeId][0]} is typing...`
                  : `${typing[activeId].length} people are typing...`}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================================= */}
        {/* 4. WHATSAPP WEB STYLE BOTTOM COMPOSER                                     */}
        {/* ========================================================================= */}
        {editingMessage && (
          <div className="pulse-reply-composer">
            <div className="pulse-quote is-static">
              <span className="pulse-quote-bar" style={{ background: OWN_QUOTE_COLOR }} />
              <span className="pulse-quote-body">
                <span className="pulse-quote-name" style={{ color: OWN_QUOTE_COLOR }}>
                  Edit message
                </span>
                <span className="pulse-quote-text">
                  <span>{editingMessage.content}</span>
                </span>
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cancelEdit}
              style={{ padding: '6px', borderRadius: '50%', color: 'var(--text-muted)', flexShrink: 0 }}
              title="Cancel editing (Esc)"
              aria-label="Cancel editing"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {replyingTo && !editingMessage && (
          <div className="pulse-reply-composer">
            <ReplyQuote preview={replyingTo} />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setReplyingTo(null)}
              style={{ padding: '6px', borderRadius: '50%', color: 'var(--text-muted)', flexShrink: 0 }}
              title="Cancel reply (Esc)"
              aria-label="Cancel reply"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <footer
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-hairline)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            position: 'relative',
          }}
        >
          {/* WhatsApp Vertical Attachment Popover Menu */}
          {isAttachMenuOpen && (
            <div
              className="pulse-attach-popover"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '16px',
                marginBottom: '10px',
                background: 'var(--surface-3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '8px',
                boxShadow: 'var(--shadow-popover)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 40,
                width: '180px',
              }}
            >
              <button
                onClick={() => {
                  setIsAttachMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '8px 10px', gap: '10px', fontSize: '12px' }}
              >
                <FileText size={15} color="#3b82f6" />
                <span>Document</span>
              </button>

              <button
                onClick={() => {
                  setIsAttachMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '8px 10px', gap: '10px', fontSize: '12px' }}
              >
                <ImageIcon size={15} color="#ec4899" />
                <span>Photos & Videos</span>
              </button>

              <button
                onClick={() => {
                  setIsAttachMenuOpen(false);
                  setMentionTaskModalOpen(true);
                }}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '8px 10px', gap: '10px', fontSize: '12px' }}
              >
                <Hash size={15} color="var(--accent-primary)" />
                <span>Sprint Task</span>
              </button>

              <button
                onClick={() => {
                  setIsAttachMenuOpen(false);
                  handleRecordAudioMemo();
                }}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '8px 10px', gap: '10px', fontSize: '12px' }}
              >
                <Mic size={15} color="#10b981" />
                <span>Audio Memo</span>
              </button>
            </div>
          )}

          {/* Attachment Paperclip Button */}
          <button
            onClick={() => setIsAttachMenuOpen((p) => !p)}
            className="btn btn-ghost"
            style={{ padding: '8px', borderRadius: '50%', color: isAttachMenuOpen ? 'var(--accent-primary)' : 'var(--text-muted)' }}
            title="Attach"
          >
            <Paperclip size={19} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* Emoji Smiley Button */}
          <button
            onClick={(e) => {
              if (emojiPicker?.mode === 'compose') {
                setEmojiPicker(null);
                return;
              }
              const r = e.currentTarget.getBoundingClientRect();
              setEmojiPicker({ mode: 'compose', x: r.left, y: r.top - 430 });
            }}
            onMouseDown={(e) => e.preventDefault()} // keep the caret in the message box
            className="btn btn-ghost"
            style={{ padding: '8px', borderRadius: '50%', color: emojiPicker?.mode === 'compose' ? 'var(--accent-primary)' : 'var(--text-muted)' }}
            title="Emoji"
            aria-label="Emoji"
          >
            <Smile size={19} />
          </button>

          {/* WhatsApp Pill Input Bar */}
          <div
            style={{
              flex: 1,
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '24px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <textarea
              ref={composerRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (e.target.value.trim()) notifyTyping(activeId);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                lineHeight: 1.4,
                resize: 'none',
                outline: 'none',
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Right Action: Voice Memo (Mic) vs Send (Plane) */}
          {inputText.trim().length > 0 || stagedAttachments.length > 0 || stagedTaskTags.length > 0 ? (
            <button
              onClick={handleSend}
              className="btn btn-primary pulse-send-btn"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              title="Send message (Enter)"
            >
              <Send size={15} />
            </button>
          ) : (
            <button
              onClick={handleRecordAudioMemo}
              className="btn btn-ghost pulse-mic-btn"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isRecording ? '#ffffff' : 'var(--accent-primary)',
                background: isRecording ? '#ef4444' : 'rgba(245, 158, 11, 0.12)',
                flexShrink: 0,
              }}
              title={isRecording ? 'Stop and send voice note' : 'Record a voice note'}
            >
              <Mic size={18} />
            </button>
          )}
        </footer>
          </>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 5. WHATSAPP STYLE CONTACT / GROUP INFO RIGHT DRAWER                       */}
      {/* ========================================================================= */}
      {isInfoDrawerOpen && (
        <aside
          style={{
            width: '380px',
            borderLeft: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 30,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          {/* WhatsApp Drawer Top Header */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeType === 'channel' ? 'Group Info' : 'Contact Info'}
              </span>
            </div>
            <button
              onClick={() => setIsInfoDrawerOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* WhatsApp Hero Profile Banner */}
            <div
              style={{
                padding: '28px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                borderBottom: '8px solid var(--surface-0)',
                background: 'var(--surface-1)',
              }}
            >
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)',
                  border: '2px solid var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
                  marginBottom: '12px',
                  fontWeight: 800,
                  fontSize: '28px',
                }}
              >
                {activeType === 'channel' ? <Hash size={38} /> : activeDM?.name.charAt(0)}
              </div>

              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {activeChannel ? `#${activeChannel.name}` : activeDM?.name || 'Pulse'}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {activeType === 'channel'
                  ? `Group &bull; ${currentGroupMembers.length} participants`
                  : `${activeDM?.role} &bull; ${activeDM?.department}`}
              </div>

              {/* WhatsApp Quick Action Tiles (Call, Video, Search) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>


                <button
                  onClick={() => setIsChatSearchOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    width: '80px',
                  }}
                >
                  <Search size={15} color="var(--accent-primary)" />
                  <span>Search</span>
                </button>
              </div>
            </div>

            {/* About / Topic Card */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '8px solid var(--surface-0)',
                background: 'var(--surface-1)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {activeType === 'channel' ? 'Group Description' : 'About'}
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {activeType === 'channel' ? activeChannel?.topic : activeDM?.role || ''}
              </p>
            </div>

            {/* Media, Links and Docs Section */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '8px solid var(--surface-0)',
                background: 'var(--surface-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => setIsPinnedDrawerOpen(true)}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Media, Links and Docs
              </span>
              <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                18 Files &gt;
              </span>
            </div>

            {/* WhatsApp Participants Section (If Group) */}
            {activeType === 'channel' && (
              <div style={{ padding: '16px 20px', background: 'var(--surface-1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {filteredGroupMembers.length} Participants
                  </span>
                </div>

                {/* Member Search */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    marginBottom: '10px',
                  }}
                >
                  <Search size={13} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Search participants..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      width: '100%',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Participants Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredGroupMembers.map((member) => {
                    const isCurrent = member.userId === 'user-current';

                    return (
                      <div
                        key={member.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--surface-2)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <div style={{ position: 'relative' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                background: isCurrent ? 'var(--accent-primary)' : 'var(--surface-4)',
                                color: isCurrent ? '#000000' : 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '12px',
                              }}
                            >
                              {isCurrent ? 'YOU' : member.name.charAt(0)}
                            </div>
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: member.status === 'online' ? '#10b981' : '#f59e0b',
                              }}
                            />
                          </div>

                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {member.name}
                              </span>
                              {member.isAdmin && (
                                <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-primary)', padding: '1px 4px', borderRadius: '4px' }}>
                                  Admin
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {member.customStatus || member.role}
                            </div>
                          </div>
                        </div>

                        {!isCurrent && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => handleDirectMessageMember(member)}
                              className="btn btn-ghost"
                              style={{ padding: '6px', borderRadius: '6px', color: 'var(--accent-primary)' }}
                              title="Message"
                            >
                              <MessageSquare size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 6. THREAD SLIDE-OVER DRAWER                                               */}
      {/* ========================================================================= */}
      {activeThreadMessage && (
        <aside
          style={{
            width: '360px',
            borderLeft: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 30,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Reply size={15} color="var(--accent-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Thread Discussion
              </span>
            </div>
            <button
              onClick={() => setActiveThreadMessage(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-hairline)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeThreadMessage.senderName}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                {activeThreadMessage.timestamp}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {activeThreadMessage.content}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {threadRepliesOf(activeThreadMessage.id).map((reply) => (
              <div key={reply.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {reply.senderName}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{reply.timestamp}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: '8px' }}>
                  {reply.content}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-hairline)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={threadInputText}
                onChange={(e) => setThreadInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendThreadReply();
                }}
                placeholder="Reply in thread..."
                style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button onClick={handleSendThreadReply} className="btn btn-primary" style={{ padding: '7px 12px', borderRadius: '8px' }}>
                <Send size={12} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 7. PINNED ITEMS DRAWER                                                    */}
      {/* ========================================================================= */}
      {isPinnedDrawerOpen && (
        <aside
          style={{
            width: '320px',
            borderLeft: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 30,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Pin size={15} color="var(--accent-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Starred & Pinned
              </span>
            </div>
            <button
              onClick={() => setIsPinnedDrawerOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentMessages.filter((m) => m.isPinned || m.isStarred).length === 0 && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Nothing starred or pinned in this chat yet. Hover a message to star or pin it (kept on this device).
              </p>
            )}
            {currentMessages
              .filter((m) => m.isPinned || m.isStarred)
              .map((m) => (
                <div key={m.id} style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                    {m.isPinned ? '📌 Pinned' : '⭐ Starred'} • {m.senderName} • {m.timestamp}
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{m.content}</p>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    {m.isStarred && <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '2px 6px' }} onClick={() => toggleStarMessage(m.id)}>Unstar</button>}
                    {m.isPinned && <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '2px 6px' }} onClick={() => togglePinMessage(m.id)}>Unpin</button>}
                  </div>
                </div>
              ))}
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 10. MENTION SPRINT TASK MODAL                                             */}
      {/* ========================================================================= */}
      {isMentionTaskModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '560px',
              maxHeight: '80vh',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-popover)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Hash size={16} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Tag Manager-Assigned Sprint Task
                </h3>
              </div>
              <button
                onClick={() => setMentionTaskModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-hairline)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              >
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search sprint tasks by key, title or assignee..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    width: '100%',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredSprintTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleStageTask(task)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-hairline)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      {task.key}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: task.priority === 'urgent' ? 'rgba(244, 63, 94, 0.18)' : 'rgba(245, 158, 11, 0.18)',
                        color: task.priority === 'urgent' ? '#f43f5e' : 'var(--accent-primary)',
                      }}
                    >
                      {task.priority}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {task.title}
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Assigned by {task.assignedByManager} &bull; {task.assigneeName} ({task.storyPoints} SP)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. CREATE GROUP MODAL                                                     */}
      {/* ========================================================================= */}
      {isCreateChannelModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '460px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-popover)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Create Team Pulse Group
              </h3>
              <button
                onClick={() => setCreateChannelModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Group Name *
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--surface-0)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                >
                  <Hash size={14} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="e.g. backend-api-sync"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    required
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      width: '100%',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Topic / Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="What is this group about?"
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  style={{
                    background: 'var(--surface-0)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    padding: '8px 12px',
                    width: '100%',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="isPrivateCheck"
                  checked={isNewChannelPrivate}
                  onChange={(e) => setIsNewChannelPrivate(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                />
                <label htmlFor="isPrivateCheck" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Make this group private (invitation only)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-hairline)' }}>
                <button
                  type="button"
                  onClick={() => setCreateChannelModalOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: '7px 14px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '7px 18px', fontSize: '12px', fontWeight: 600 }}
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {messageMenu && (
        <MessageMenu
          msg={messageMenu.msg}
          x={messageMenu.x}
          y={messageMenu.y}
          onClose={() => setMessageMenu(null)}
          onReact={(emoji) => toggleReaction(messageMenu.msg.id, emoji, 'user-current')}
          onMoreReactions={(x, y) => setEmojiPicker({ mode: 'react', messageId: messageMenu.msg.id, x, y })}
          onReply={() => startReply(messageMenu.msg)}
          onCopy={() => copyMessageText(messageMenu.msg.content)}
          onStar={() => toggleStarMessage(messageMenu.msg.id)}
          onPin={() => togglePinMessage(messageMenu.msg.id)}
          onThread={() => setActiveThreadMessage(messageMenu.msg)}
          onDownload={
            messageMenu.msg.attachments?.[0]
              ? () => void handleOpenAttachment(messageMenu.msg.attachments![0], true)
              : undefined
          }
          onEdit={
            messageMenu.msg.senderId === 'user-current' && messageMenu.msg.content && !messageMenu.msg.attachments?.length && !messageMenu.msg.voiceNote
              ? () => startEdit(messageMenu.msg)
              : undefined
          }
          // Only the sender can delete a message for everyone.
          onDelete={messageMenu.msg.senderId === 'user-current' ? () => setConfirmDeleteMsg(messageMenu.msg) : undefined}
        />
      )}

      {emojiPicker && (
        <EmojiPicker
          x={emojiPicker.x}
          y={emojiPicker.y}
          closeOnPick={emojiPicker.mode === 'react'}
          onClose={() => setEmojiPicker(null)}
          onPick={(emoji) => {
            if (emojiPicker.mode === 'compose') insertEmoji(emoji);
            else if (emojiPicker.messageId) toggleReaction(emojiPicker.messageId, emoji, 'user-current');
          }}
        />
      )}

      {confirmDeleteMsg && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteMsg(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Delete for everyone?</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Everyone in this chat will see that the message was deleted.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteMsg(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  void deleteMessage(confirmDeleteMsg.id);
                  setConfirmDeleteMsg(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PulseDesk;
