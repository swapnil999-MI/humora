import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  Lock,
  Plus,
  Search,
  Paperclip,
  Smile,
  Send,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Users,
  X,
  ExternalLink,
  ChevronRight,
  Download,
  Eye,
  AtSign,
  Radio,
  Sparkles,
  ShieldAlert,
  Flame,
  ThumbsUp,
  Heart,
  Rocket,
  MessageSquare,
} from 'lucide-react';
import { usePulseStore, PulseAttachment, PulseTaskTag, PulseMessage } from '../../store/pulseStore';
import { useWorkStore } from '../../store/workStore';
import { useUiStore } from '../../store/uiStore';

export const PulseDesk: React.FC = () => {
  const {
    activeType,
    activeId,
    channels,
    directMessages,
    messages,
    searchQuery,
    isCreateChannelModalOpen,
    isMentionTaskModalOpen,
    setActiveConversation,
    setSearchQuery,
    sendMessage,
    toggleReaction,
    createChannel,
    setCreateChannelModalOpen,
    setMentionTaskModalOpen,
  } = usePulseStore();

  const { kanbanBoard, setActiveIssue } = useWorkStore();
  const { addToast } = useUiStore();

  // Local state for message input
  const [inputText, setInputText] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState<PulseAttachment[]>([]);
  const [stagedTaskTags, setStagedTaskTags] = useState<PulseTaskTag[]>([]);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');

  // Channel creation modal state
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

  // Determine active conversation details
  const activeChannel = channels.find((c) => c.id === activeId);
  const activeDM = directMessages.find((dm) => dm.id === activeId);

  // Filter channels and DMs based on search query
  const filteredChannels = channels.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDMs = directMessages.filter(
    (dm) =>
      dm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dm.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dm.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Available manager-assigned sprint tasks for tagging
  const availableSprintTasks: PulseTaskTag[] = [
    {
      id: 'task-pay-101',
      key: 'PAY-101',
      title: 'Implement Biometric LOP Deductions & IT Regime TDS Planner',
      status: 'in_progress',
      priority: 'urgent',
      assigneeName: 'Rohan Deshmukh',
      assignedByManager: 'Sarah Jenkins (VP)',
      storyPoints: 5,
    },
    {
      id: 'task-eng-204',
      key: 'ENG-204',
      title: 'Optimize Fiber v2 Route Middleware & SQL Connection Pooling',
      status: 'review',
      priority: 'high',
      assigneeName: 'Alex Rivera',
      assignedByManager: 'Sarah Jenkins (VP)',
      storyPoints: 8,
    },
    {
      id: 'task-ux-302',
      key: 'UX-302',
      title: 'Standardize Soft Button Theme & Toast Notifications',
      status: 'done',
      priority: 'medium',
      assigneeName: 'Priya Sharma',
      assignedByManager: 'Sarah Jenkins (VP)',
      storyPoints: 3,
    },
    {
      id: 'task-api-105',
      key: 'API-105',
      title: 'Wire Up Timesheet Sign-Off & Biometric Sync Endpoints',
      status: 'todo',
      priority: 'high',
      assigneeName: 'Alex Rivera',
      assignedByManager: 'Alex Rivera (Lead)',
      storyPoints: 5,
    },
    {
      id: 'task-sec-404',
      key: 'SEC-404',
      title: 'Corporate Seal & Digital Signatory Verification Audit',
      status: 'in_progress',
      priority: 'urgent',
      assigneeName: 'Sarah Jenkins',
      assignedByManager: 'Sarah Jenkins (VP)',
      storyPoints: 4,
    },
  ];

  const filteredSprintTasks = availableSprintTasks.filter(
    (t) =>
      t.key.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      t.assigneeName.toLowerCase().includes(taskSearchQuery.toLowerCase())
  );

  // Send message handler
  const handleSend = () => {
    if (!inputText.trim() && stagedAttachments.length === 0 && stagedTaskTags.length === 0) return;

    sendMessage(activeId, inputText, stagedAttachments, stagedTaskTags);
    setInputText('');
    setStagedAttachments([]);
    setStagedTaskTags([]);
    setIsEmojiPickerOpen(false);
  };

  // Keyboard shortcut in message textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle file attachment simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isImg = file.type.startsWith('image/');
    const newAtt: PulseAttachment = {
      id: `att-${Date.now()}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type: isImg ? 'image' : file.name.endsWith('.pdf') ? 'pdf' : 'document',
      url: URL.createObjectURL(file),
      previewUrl: isImg ? URL.createObjectURL(file) : undefined,
    };

    setStagedAttachments((prev) => [...prev, newAtt]);
    addToast({ type: 'info', message: `Attached "${file.name}" to draft.` });
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

  // Create Channel submission
  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    createChannel(newChannelName, newChannelTopic, isNewChannelPrivate);
    setNewChannelName('');
    setNewChannelTopic('');
    setIsNewChannelPrivate(false);
    addToast({ type: 'success', message: `Created group #${newChannelName}.` });
  };

  // Inspect task in IssueDrawer
  const handleInspectTask = (task: PulseTaskTag) => {
    // Find matching issue from kanbanBoard if available, or construct Issue object
    const allBoardIssues = kanbanBoard?.columns.flatMap((c) => c.issues) || [];
    const foundIssue = allBoardIssues.find((i) => i.issue_key === task.key || i.id === task.id);

    if (foundIssue) {
      setActiveIssue(foundIssue);
    } else {
      setActiveIssue({
        id: task.id,
        project_id: 'proj-humora',
        issue_key: task.key,
        title: task.title,
        description: `Task tagged from Team Pulse. Assigned by manager: ${task.assignedByManager}.`,
        issue_type: 'task',
        status: task.status === 'done' ? 'DONE' : task.status === 'in_progress' ? 'IN_PROGRESS' : 'TODO',
        priority: task.priority,
        reporter_id: 'manager',
        assignee_id: 'me',
        story_points: task.storyPoints || 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);
    }
    addToast({ type: 'info', message: `Opened task #${task.key} in Issue Drawer.` });
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 64px)',
        background: 'var(--surface-0)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {/* 1. LEFT CONVERSATIONS NAV PANE */}
      <aside
        style={{
          width: '320px',
          borderRight: '1px solid var(--border-hairline)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Pane Header */}
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
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                boxShadow: '0 0 10px rgba(245, 158, 11, 0.6)',
              }}
            />
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Team Pulse
            </h2>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'var(--accent-primary-subtle)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              Live
            </span>
          </div>

          <button
            onClick={() => setCreateChannelModalOpen(true)}
            className="btn btn-ghost"
            title="Create New Group"
            style={{ padding: '6px 8px', borderRadius: '6px' }}
          >
            <Plus size={16} color="var(--accent-primary)" />
          </button>
        </div>

        {/* Conversation Search Filter */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 10px',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Filter groups or people..."
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
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Channels & DMs Scrollable Lists */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section: Groups */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px 6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
              }}
            >
              <span>Groups ({filteredChannels.length})</span>
              <button
                onClick={() => setCreateChannelModalOpen(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
              >
                + Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filteredChannels.map((c) => {
                const isActive = activeType === 'channel' && activeId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveConversation(c.id, 'channel')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: isActive ? 'var(--accent-primary-subtle)' : 'transparent',
                      border: isActive ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {c.isPrivate ? <Lock size={14} color="var(--text-muted)" /> : <Hash size={15} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />}
                      <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {c.name}
                      </span>
                    </div>

                    {c.unreadCount > 0 && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: 'var(--accent-primary)',
                          color: '#000000',
                        }}
                      >
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Direct Messages */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px 6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
              }}
            >
              <span>Direct Messages ({filteredDMs.length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {filteredDMs.map((dm) => {
                const isActive = activeType === 'dm' && activeId === dm.id;
                const statusColor =
                  dm.status === 'online'
                    ? '#10b981'
                    : dm.status === 'busy'
                    ? 'var(--accent-rose)'
                    : dm.status === 'away'
                    ? 'var(--accent-primary)'
                    : 'var(--text-muted)';

                return (
                  <button
                    key={dm.id}
                    onClick={() => setActiveConversation(dm.id, 'dm')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: isActive ? 'var(--accent-primary-subtle)' : 'transparent',
                      border: isActive ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Colleague Avatar with Status Dot */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {dm.name.charAt(0)}
                      </div>
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-1px',
                          right: '-1px',
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          background: statusColor,
                          border: '2px solid var(--surface-1)',
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dm.name}
                        </div>
                        {dm.unreadCount > 0 && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '10px',
                              background: 'var(--accent-primary)',
                              color: '#000000',
                            }}
                          >
                            {dm.unreadCount}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                        {dm.lastMessageSnippet || dm.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN ACTIVE CHAT STREAM */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-0)',
          overflow: 'hidden',
        }}
      >
        {/* Chat Stream Header */}
        <header
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeType === 'channel' ? (
              <>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary-subtle)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <Hash size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {activeChannel?.name || 'Group'}
                    </h1>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        background: 'var(--surface-2)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-hairline)',
                      }}
                    >
                      {activeChannel?.memberCount || 1} members
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '600px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeChannel?.topic}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {activeDM?.name.charAt(0) || 'U'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {activeDM?.name || 'Direct Message'}
                    </h1>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background:
                          activeDM?.status === 'online'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : activeDM?.status === 'busy'
                            ? 'rgba(244, 63, 94, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                        color:
                          activeDM?.status === 'online'
                            ? '#34d399'
                            : activeDM?.status === 'busy'
                            ? 'var(--accent-rose)'
                            : 'var(--accent-primary)',
                        border: '1px solid var(--border-hairline)',
                      }}
                    >
                      {activeDM?.status}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {activeDM?.role} &bull; {activeDM?.department}
                  </p>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setMentionTaskModalOpen(true)}
              className="btn btn-secondary"
              style={{
                fontSize: '12px',
                padding: '7px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Hash size={13} color="var(--accent-primary)" />
              <span>Mention Sprint Task</span>
            </button>
          </div>
        </header>

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Top Welcome Indicator */}
          <div
            style={{
              padding: '20px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'var(--accent-primary-subtle)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <Radio size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Welcome to {activeType === 'channel' ? `#${activeChannel?.name}` : activeDM?.name}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                This is the start of the persistent conversation history. You can share project updates, media files, and tag manager-assigned sprint tasks.
              </p>
            </div>
          </div>

          {/* Messages */}
          {currentMessages.map((msg) => {
            const isMe = msg.senderId === 'user-current';

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: isMe ? 'var(--accent-primary)' : 'var(--surface-2)',
                    color: isMe ? '#000000' : 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  {msg.senderName.charAt(0)}
                </div>

                {/* Message Body */}
                <div style={{ flex: 1, maxWidth: '850px' }}>
                  {/* Sender Header */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {msg.senderName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {msg.senderRole}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Text Content */}
                  {msg.content && (
                    <div
                      style={{
                        fontSize: '13px',
                        lineHeight: 1.55,
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* TAGGED TASKS CARDS */}
                  {msg.taggedTasks && msg.taggedTasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                      {msg.taggedTasks.map((task) => (
                        <div
                          key={task.id}
                          style={{
                            background: 'var(--surface-1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '10px',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '14px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                            <div
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'var(--accent-primary-subtle)',
                                color: 'var(--accent-primary)',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                fontSize: '11px',
                                letterSpacing: '0.04em',
                                flexShrink: 0,
                              }}
                            >
                              {task.key}
                            </div>

                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {task.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                <span>{task.assignedByManager}</span>
                                <span>&bull;</span>
                                <span style={{ textTransform: 'uppercase', fontWeight: 600, color: task.priority === 'urgent' ? 'var(--accent-rose)' : 'var(--accent-primary)' }}>
                                  {task.priority}
                                </span>
                                <span>&bull;</span>
                                <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                                  {task.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleInspectTask(task)}
                            className="btn btn-ghost"
                            style={{
                              padding: '6px 12px',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle)',
                              flexShrink: 0,
                              color: 'var(--accent-primary)',
                            }}
                          >
                            <span>Inspect Task</span>
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ATTACHED MEDIA & FILES */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          style={{
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border-hairline)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            maxWidth: '380px',
                          }}
                        >
                          {att.type === 'image' ? (
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '6px',
                                background: 'var(--surface-2)',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <img src={att.previewUrl || att.url} alt={att.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '8px',
                                background: 'var(--accent-primary-subtle)',
                                color: 'var(--accent-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <FileText size={18} />
                            </div>
                          )}

                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {att.name}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {att.size} &bull; {att.type.toUpperCase()}
                            </div>
                          </div>

                          <a
                            href={att.url}
                            download={att.name}
                            className="btn btn-ghost"
                            style={{ padding: '6px', borderRadius: '6px' }}
                            title="Download File"
                          >
                            <Download size={13} color="var(--accent-primary)" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* REACTIONS BAR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                    {msg.reactions?.map((rx) => {
                      const hasReacted = rx.users.includes('user-current');
                      return (
                        <button
                          key={rx.emoji}
                          onClick={() => toggleReaction(msg.id, rx.emoji, 'user-current')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: hasReacted ? 'var(--accent-primary-subtle)' : 'var(--surface-1)',
                            border: `1px solid ${hasReacted ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-hairline)'}`,
                            color: hasReacted ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                          }}
                        >
                          <span>{rx.emoji}</span>
                          <span>{rx.count}</span>
                        </button>
                      );
                    })}

                    {/* Quick Reaction Triggers */}
                    <div style={{ display: 'flex', gap: '2px', opacity: 0.7 }}>
                      {['👍', '🚀', '❤️', '👀'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji, 'user-current')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '2px 4px',
                            borderRadius: '4px',
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 3. MESSAGE COMPOSER */}
        <footer
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Staged Tagged Tasks / Attachments Preview */}
          {(stagedTaskTags.length > 0 || stagedAttachments.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '4px' }}>
              {stagedTaskTags.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary-subtle)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: 'var(--accent-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <span>#{task.key}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{task.title.slice(0, 30)}...</span>
                  <button
                    onClick={() => setStagedTaskTags((prev) => prev.filter((t) => t.id !== task.id))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {stagedAttachments.map((att) => (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                  }}
                >
                  <Paperclip size={12} color="var(--accent-primary)" />
                  <span>{att.name}</span>
                  <button
                    onClick={() => setStagedAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main Input Box */}
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeType === 'channel'
                  ? `Message #${activeChannel?.name}... (Enter to send, Shift+Enter for newline)`
                  : `Direct message ${activeDM?.name}...`
              }
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

            {/* Composer Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Mention Sprint Task Button */}
                <button
                  type="button"
                  onClick={() => setMentionTaskModalOpen(true)}
                  className="btn btn-ghost"
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    borderRadius: '6px',
                    color: 'var(--accent-primary)',
                  }}
                  title="Tag an active sprint task"
                >
                  <Hash size={13} />
                  <span>Mention Task</span>
                </button>

                {/* File Attachment Input Trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-ghost"
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    borderRadius: '6px',
                  }}
                  title="Attach file or media"
                >
                  <Paperclip size={13} color="var(--text-muted)" />
                  <span>Attach</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                {/* Quick Emoji Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + ' 🚀');
                  }}
                  className="btn btn-ghost"
                  style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '12px' }}
                  title="Add Rocket"
                >
                  🚀
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + ' 👍');
                  }}
                  className="btn btn-ghost"
                  style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '12px' }}
                  title="Add Thumbs Up"
                >
                  👍
                </button>
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputText.trim() && stagedAttachments.length === 0 && stagedTaskTags.length === 0}
                className="btn btn-primary"
                style={{
                  padding: '7px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                }}
              >
                <span>Send</span>
                <Send size={13} />
              </button>
            </div>
          </div>
        </footer>
      </main>

      {/* 4. TASK MENTION MODAL */}
      {isMentionTaskModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-1)',
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

            <div style={{ padding: '16px 20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '14px',
                }}
              >
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search by ticket key, title, or assignee..."
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {filteredSprintTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleStageTask(task)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border-hairline)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          padding: '3px 7px',
                          borderRadius: '6px',
                          background: 'var(--accent-primary-subtle)',
                          color: 'var(--accent-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        {task.key}
                      </span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {task.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Assignee: {task.assigneeName} &bull; {task.assignedByManager}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: 'var(--accent-primary)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                      }}
                    >
                      {task.priority}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. CREATE CHANNEL MODAL */}
      {isCreateChannelModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-1)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
                    fontSize: '13px',
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
