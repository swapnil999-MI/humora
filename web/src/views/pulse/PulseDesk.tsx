import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import {
  usePulseStore,
  PulseAttachment,
  PulseTaskTag,
  PulseMemberView,
  PulseTick,
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

  // Local state for message input
  const [inputText, setInputText] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState<PulseAttachment[]>([]);
  const [stagedTaskTags, setStagedTaskTags] = useState<PulseTaskTag[]>([]);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

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

  // Send message handler
  const handleSend = () => {
    if (!inputText.trim() && stagedAttachments.length === 0 && stagedTaskTags.length === 0) return;

    if (!inputText.trim()) {
      addToast({ type: 'info', message: 'Type a message to send with the tagged task.' });
      return;
    }
    // The task picker still lists sample tasks; only tags that point at a real task can be sent.
    if (stagedTaskTags.some((t) => !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t.id))) {
      addToast({ type: 'info', message: 'That tag does not point at a task you can access, so the message was sent without it.' });
    }
    sendMessage(activeId, inputText, stagedAttachments, stagedTaskTags);
    setInputText('');
    setStagedAttachments([]);
    setStagedTaskTags([]);
    setIsEmojiPickerOpen(false);
    setIsAttachMenuOpen(false);
  };

  // Keyboard shortcut in message textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (await sendFile(activeId, file)) addToast({ type: 'success', message: `Sent "${file.name}".` });
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
    const startedAt = Date.now();
    recorder.ondataavailable = (ev) => chunks.push(ev.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      setIsRecording(false);
      const recording = new Blob(chunks, { type: recorder.mimeType });
      if (recording.size === 0) return;
      if (await sendVoiceNote(conversationId, recording, Date.now() - startedAt)) {
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
    if (member.dmId) setActiveConversation(member.dmId, 'dm');
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
          {filteredConversations.map((item) => {
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
          })}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN ACTIVE CONVERSATION CANVAS (WHATSAPP WEB UX)                     */}
      {/* ========================================================================= */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* WhatsApp Chat Top Navigation Header */}
        <header
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
                className={`pulse-msg-row ${isMe ? 'msg-out' : 'msg-in'}`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '68%',
                  margin: '4px 0',
                  marginRight: isMe ? '8px' : '0',
                  marginLeft: !isMe ? '8px' : '0',
                }}
              >
                {/* Floating Micro Hover Reactions Pill */}
                {isHovered && (
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
                    <button
                      onClick={() => toggleReaction(msg.id, '👍', 'user-current')}
                      className="reaction-emoji-btn"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => toggleReaction(msg.id, '❤️', 'user-current')}
                      className="reaction-emoji-btn"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      ❤️
                    </button>
                    <button
                      onClick={() => toggleReaction(msg.id, '🔥', 'user-current')}
                      className="reaction-emoji-btn"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      🔥
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStarMessage(msg.id)}
                      title={msg.isStarred ? 'Unstar' : 'Star (this device)'}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: msg.isStarred ? 1 : 0.6 }}
                    >
                      ⭐
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePinMessage(msg.id)}
                      title={msg.isPinned ? 'Unpin' : 'Pin (this device)'}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: msg.isPinned ? 1 : 0.6 }}
                    >
                      📌
                    </button>
                    <button
                      onClick={() => toggleReaction(msg.id, '🚀', 'user-current')}
                      className="reaction-emoji-btn"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      🚀
                    </button>
                    <button
                      onClick={() => setActiveThreadMessage(msg)}
                      className="reaction-emoji-btn"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px' }}
                      title="Reply"
                    >
                      <Reply size={12} />
                    </button>
                  </div>
                )}

                {/* Message Bubble Card */}
                <div
                  className={isMe ? 'whatsapp-bubble-out' : 'whatsapp-bubble-in'}
                  style={{
                    padding: '8px 12px',
                    position: 'relative',
                  }}
                >
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
                        color:
                          msg.senderName.includes('Sarah')
                            ? 'var(--accent-primary)'
                            : msg.senderName.includes('Alex')
                            ? '#fbbf24'
                            : '#f43f5e',
                        marginBottom: '3px',
                      }}
                    >
                      {msg.senderName}
                    </div>
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
            onClick={() => setInputText((p) => p + ' 😊')}
            className="btn btn-ghost"
            style={{ padding: '8px', borderRadius: '50%', color: 'var(--text-muted)' }}
            title="Emoji"
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
    </div>
  );
};

export default PulseDesk;
