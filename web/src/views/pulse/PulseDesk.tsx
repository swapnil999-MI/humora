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
  UserPlus,
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
  Mic,
  MicOff,
  Volume2,
  Play,
  Pause,
  Bookmark,
  Pin,
  Reply,
  Copy,
  Check,
  Zap,
  Phone,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  ShieldCheck,
  MoreVertical,
} from 'lucide-react';
import {
  usePulseStore,
  PulseAttachment,
  PulseTaskTag,
  PulseMessage,
  PulseVoiceNote,
} from '../../store/pulseStore';
import { useWorkStore } from '../../store/workStore';
import { useUiStore } from '../../store/uiStore';

interface GroupMember {
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
    isHuddleActive,
    huddleChannelId,
    activeThreadMessage,
    setActiveConversation,
    setSearchQuery,
    sendMessage,
    toggleReaction,
    toggleStarMessage,
    togglePinMessage,
    toggleHuddle,
    setActiveThreadMessage,
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
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // WhatsApp-like Group Members Drawer state
  const [isGroupInfoDrawerOpen, setIsGroupInfoDrawerOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [activeCallPartner, setActiveCallPartner] = useState<{
    name: string;
    role: string;
    type: 'voice' | 'video';
  } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);

  // Spicy tadka states
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceElapsedSec, setVoiceElapsedSec] = useState(18);
  const [isPinnedBannerExpanded, setIsPinnedBannerExpanded] = useState(true);
  const [isPinnedDrawerOpen, setIsPinnedDrawerOpen] = useState(false);
  const [threadInputText, setThreadInputText] = useState('');
  const [threadReplies, setThreadReplies] = useState<
    Record<string, { id: string; senderName: string; role: string; text: string; time: string }[]>
  >({
    'msg-eng-voice-1': [
      {
        id: 'tr-1',
        senderName: 'Alex Rivera',
        role: 'Staff Lead',
        text: 'Checked! Upstream cluster health is green on both ports.',
        time: '10:14 AM',
      },
      {
        id: 'tr-2',
        senderName: 'Rohan Deshmukh',
        role: 'Fullstack Eng',
        text: 'Confirmed. Ready for traffic cutover as per the runbook.',
        time: '10:18 AM',
      },
      {
        id: 'tr-3',
        senderName: 'Priya Sharma',
        role: 'Product Designer',
        text: 'Zero UI regressions detected on our staging smoke run.',
        time: '10:22 AM',
      },
    ],
  });

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

  // Voice note playback simulation
  useEffect(() => {
    let timer: any;
    if (playingVoiceId) {
      timer = setInterval(() => {
        setVoiceElapsedSec((prev) => {
          if (prev >= 45) {
            setPlayingVoiceId(null);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [playingVoiceId]);

  // Active call duration timer
  useEffect(() => {
    let callTimer: any;
    if (activeCallPartner) {
      callTimer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(callTimer);
  }, [activeCallPartner]);

  // Monitor slash command triggers in input
  useEffect(() => {
    if (inputText.startsWith('/')) {
      setIsSlashMenuOpen(true);
    } else {
      setIsSlashMenuOpen(false);
    }
  }, [inputText]);

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

  // Rich WhatsApp-style member roster for each squad/group
  const allSquadMembers: Record<string, GroupMember[]> = {
    'chan-engineering': [
      {
        id: 'mem-1',
        userId: 'user-sarah',
        name: 'Sarah Jenkins',
        role: 'VP of Engineering',
        department: 'Engineering Leadership',
        status: 'online',
        customStatus: 'Reviewing Q3 sprint deliverables',
        isAdmin: true,
        dmId: 'dm-sarah',
      },
      {
        id: 'mem-2',
        userId: 'user-alex',
        name: 'Alex Rivera',
        role: 'Staff Lead Architect',
        department: 'Core Infrastructure',
        status: 'online',
        customStatus: 'Testing NGINX blue-green switches',
        isAdmin: true,
        dmId: 'dm-alex',
      },
      {
        id: 'mem-3',
        userId: 'user-priya',
        name: 'Priya Sharma',
        role: 'Principal Product Designer',
        department: 'Product Design',
        status: 'online',
        customStatus: 'Polishing dark mode design tokens',
        dmId: 'dm-priya',
      },
      {
        id: 'mem-4',
        userId: 'user-rohan',
        name: 'Rohan Deshmukh',
        role: 'Senior Fullstack Engineer',
        department: 'Frontend Engineering',
        status: 'away',
        customStatus: 'Reconciling weekly timesheets',
        dmId: 'dm-rohan',
      },
      {
        id: 'mem-5',
        userId: 'user-current',
        name: 'You',
        role: 'Senior Systems Engineer',
        department: 'Platform Architecture',
        status: 'online',
        customStatus: 'In Deep Flow 🎧',
      },
      {
        id: 'mem-6',
        userId: 'user-vikram',
        name: 'Vikram Patel',
        role: 'DevOps & Cloud Lead',
        department: 'Infrastructure',
        status: 'online',
        customStatus: 'Terraform pipelines green 🚀',
      },
      {
        id: 'mem-7',
        userId: 'user-ananya',
        name: 'Ananya Iyer',
        role: 'Lead QA Automation',
        department: 'Quality Engineering',
        status: 'online',
        customStatus: 'Running E2E regression suite',
      },
    ],
    'chan-general': [
      {
        id: 'mem-1',
        userId: 'user-sarah',
        name: 'Sarah Jenkins',
        role: 'VP of Engineering',
        department: 'Leadership',
        status: 'online',
        isAdmin: true,
        dmId: 'dm-sarah',
      },
      {
        id: 'mem-2',
        userId: 'user-alex',
        name: 'Alex Rivera',
        role: 'Staff Lead',
        department: 'Engineering',
        status: 'online',
        dmId: 'dm-alex',
      },
      {
        id: 'mem-3',
        userId: 'user-priya',
        name: 'Priya Sharma',
        role: 'Product Designer',
        department: 'Design',
        status: 'online',
        dmId: 'dm-priya',
      },
      {
        id: 'mem-4',
        userId: 'user-rohan',
        name: 'Rohan Deshmukh',
        role: 'Senior Engineer',
        department: 'Engineering',
        status: 'away',
        dmId: 'dm-rohan',
      },
      {
        id: 'mem-5',
        userId: 'user-current',
        name: 'You',
        role: 'Senior Systems Engineer',
        department: 'Platform',
        status: 'online',
      },
    ],
    'chan-sprint-room': [
      {
        id: 'mem-1',
        userId: 'user-sarah',
        name: 'Sarah Jenkins',
        role: 'VP of Engineering',
        department: 'Leadership',
        status: 'online',
        isAdmin: true,
        dmId: 'dm-sarah',
      },
      {
        id: 'mem-2',
        userId: 'user-alex',
        name: 'Alex Rivera',
        role: 'Staff Lead',
        department: 'Engineering',
        status: 'online',
        dmId: 'dm-alex',
      },
      {
        id: 'mem-4',
        userId: 'user-rohan',
        name: 'Rohan Deshmukh',
        role: 'Senior Engineer',
        department: 'Engineering',
        status: 'away',
        dmId: 'dm-rohan',
      },
      {
        id: 'mem-5',
        userId: 'user-current',
        name: 'You',
        role: 'Senior Systems Engineer',
        department: 'Platform',
        status: 'online',
      },
    ],
    'chan-product-design': [
      {
        id: 'mem-3',
        userId: 'user-priya',
        name: 'Priya Sharma',
        role: 'Principal Product Designer',
        department: 'Design',
        status: 'online',
        isAdmin: true,
        dmId: 'dm-priya',
      },
      {
        id: 'mem-1',
        userId: 'user-sarah',
        name: 'Sarah Jenkins',
        role: 'VP of Engineering',
        department: 'Leadership',
        status: 'online',
        dmId: 'dm-sarah',
      },
      {
        id: 'mem-4',
        userId: 'user-rohan',
        name: 'Rohan Deshmukh',
        role: 'Senior Engineer',
        department: 'Engineering',
        status: 'away',
        dmId: 'dm-rohan',
      },
      {
        id: 'mem-5',
        userId: 'user-current',
        name: 'You',
        role: 'Senior Systems Engineer',
        department: 'Platform',
        status: 'online',
      },
    ],
  };

  const currentGroupMembers: GroupMember[] =
    allSquadMembers[activeId] || allSquadMembers['chan-engineering'];

  const filteredGroupMembers = currentGroupMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(memberSearchQuery.toLowerCase())
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
    setIsSlashMenuOpen(false);
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

  // Quick 30m Log Shortcut directly on chat task card
  const handleQuickLog30m = (taskKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    addToast({
      type: 'success',
      message: `⚡ Quick-Logged +30m to [${taskKey}] & synced to Workday ledger.`,
    });
  };

  // Simulate Instant Audio Memo Recording
  const handleRecordAudioMemo = () => {
    const simulatedWaveform = [
      24, 42, 65, 88, 48, 72, 96, 100, 78, 55, 68, 86, 92, 60, 42, 76, 88, 56, 40, 72, 48, 28, 38,
      18,
    ];
    const voiceNote: PulseVoiceNote = {
      duration: '0:34',
      waveform: simulatedWaveform,
      transcription:
        'Voice memo: Verified the zero-downtime blue-green health check scripts and NGINX configs.',
    };
    sendMessage(
      activeId,
      '🎙️ Quick Voice Memo from production floor:',
      [],
      [],
      voiceNote
    );
    addToast({ type: 'success', message: '🎙️ Voice note published with waveform visualizer.' });
  };

  // WhatsApp UX: Direct Message a Member
  const handleDirectMessageMember = (member: GroupMember) => {
    setIsGroupInfoDrawerOpen(false);
    if (member.dmId) {
      setActiveConversation(member.dmId, 'dm');
      addToast({ type: 'success', message: `Opened 1:1 Direct Message with ${member.name}.` });
    } else {
      addToast({
        type: 'info',
        message: `Direct message thread initialized for ${member.name}.`,
      });
    }
  };

  // WhatsApp UX: Start Call with Member
  const handleStartCallMember = (member: GroupMember, type: 'voice' | 'video') => {
    setActiveCallPartner({ name: member.name, role: member.role, type });
    addToast({
      type: 'info',
      message: `📞 Calling ${member.name} (${type === 'voice' ? 'Voice Call' : 'Video Call'})...`,
    });
  };

  // End Call Handler
  const handleEndCall = () => {
    if (activeCallPartner) {
      addToast({
        type: 'info',
        message: `Call ended with ${activeCallPartner.name}. Duration: ${Math.floor(callDuration / 60)}m ${callDuration % 60}s.`,
      });
      setActiveCallPartner(null);
      setCallDuration(0);
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

  // Inspect task in IssueDrawer
  const handleInspectTask = (task: PulseTaskTag) => {
    const allBoardIssues = kanbanBoard?.columns.flatMap((c) => c.issues) || [];
    const foundIssue = allBoardIssues.find((i) => i.issue_key === task.key || i.id === task.id);

    if (foundIssue) {
      setActiveIssue(foundIssue);
    } else {
      setActiveIssue({
        id: task.id,
        tenant_id: 'tenant-1',
        project_id: 'proj-1',
        issue_number: 101,
        issue_key: task.key,
        title: task.title,
        description: `Task tagged from Team Pulse conversation.\n\nManager: ${task.assignedByManager}\nStatus: ${task.status}`,
        issue_type: 'task',
        status_id: 'status-todo',
        status_name: task.status,
        status_category: 'in_progress',
        priority: task.priority as any,
        reporter_id: 'user-sarah',
        story_points: task.storyPoints || 3,
        original_estimate_seconds: 28800,
        remaining_estimate_seconds: 14400,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  // Post reply in thread drawer
  const handleSendThreadReply = () => {
    if (!activeThreadMessage || !threadInputText.trim()) return;
    const msgId = activeThreadMessage.id;
    const newReply = {
      id: `tr-${Date.now()}`,
      senderName: 'You',
      role: 'Senior Engineer',
      text: threadInputText,
      time: 'Just now',
    };
    setThreadReplies((prev) => ({
      ...prev,
      [msgId]: [...(prev[msgId] || []), newReply],
    }));
    setThreadInputText('');
    addToast({ type: 'success', message: 'Thread reply posted.' });
  };

  // Quick Slash Command Executor
  const handleExecuteSlash = (cmd: string) => {
    if (cmd === 'task') {
      setInputText('');
      setIsSlashMenuOpen(false);
      setMentionTaskModalOpen(true);
    } else if (cmd === 'huddle') {
      setInputText('');
      setIsSlashMenuOpen(false);
      toggleHuddle(activeId);
      addToast({
        type: 'info',
        message: isHuddleActive
          ? 'Left voice huddle.'
          : '🎙️ Joined Live Squad Voice Huddle with spatial audio.',
      });
    } else if (cmd === 'standup') {
      setInputText(
        `**Daily Standup Update**\n- **Yesterday:** Implemented payroll LOP deductions\n- **Today:** Reviewing traffic switch scripts\n- **Blockers:** None`
      );
      setIsSlashMenuOpen(false);
    } else if (cmd === 'kudos') {
      setInputText(`🎉 Huge shoutout and kudos to the squad for shipping the sprint deliverables ahead of time!`);
      setIsSlashMenuOpen(false);
    }
  };

  const activeHuddle = isHuddleActive && huddleChannelId === activeId;

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
      <div
        className="pulse-ambient-glow"
        style={{
          bottom: '-10%',
          left: '30%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(217, 119, 6, 0.04) 0%, transparent 70%)',
        }}
      />

      {/* ========================================================================= */}
      {/* ACTIVE CALL FLOATING OVERLAY / BANNER (WHATSAPP UX)                       */}
      {/* ========================================================================= */}
      {activeCallPartner && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '24px',
            zIndex: 100,
            background: 'linear-gradient(135deg, rgba(32, 30, 27, 0.96) 0%, rgba(18, 17, 16, 0.98) 100%)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '14px',
            padding: '12px 18px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7), 0 0 16px rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              {activeCallPartner.name.charAt(0)}
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
                boxShadow: '0 0 8px #10b981',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeCallPartner.name}
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                }}
              >
                {callDuration > 2 ? 'Connected' : 'Ringing...'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '10px' }}>
                <div className="huddle-wave-bar" style={{ height: '8px' }} />
                <div className="huddle-wave-bar" style={{ height: '12px', animationDelay: '-0.3s' }} />
                <div className="huddle-wave-bar" style={{ height: '7px', animationDelay: '-0.5s' }} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {activeCallPartner.type === 'voice' ? 'Direct Voice Call' : 'Direct Video Call'} &bull;{' '}
                {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Call Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <button
              onClick={() => setIsCallMuted((p) => !p)}
              className="btn btn-ghost"
              style={{
                padding: '8px',
                borderRadius: '50%',
                background: isCallMuted ? 'rgba(239, 68, 68, 0.2)' : 'var(--surface-3)',
                color: isCallMuted ? '#ef4444' : 'var(--text-primary)',
              }}
              title={isCallMuted ? 'Unmute' : 'Mute'}
            >
              {isCallMuted ? <MicOff size={15} /> : <Mic size={15} />}
            </button>

            <button
              onClick={handleEndCall}
              style={{
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
              }}
              title="End Call"
            >
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. LEFT CONVERSATION NAVIGATION DRAWER / ROSTER                           */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: '280px',
          borderRight: '1px solid var(--border-hairline)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        {/* Header with Title & Quick Add Group */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'var(--accent-primary-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <Radio size={14} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              TEAM PULSE
            </span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: 'rgba(245, 158, 11, 0.18)',
                color: 'var(--accent-primary)',
                padding: '2px 6px',
                borderRadius: '4px',
                letterSpacing: '0.06em',
                border: '1px solid rgba(245, 158, 11, 0.3)',
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
            <Plus size={15} color="var(--accent-primary)" />
          </button>
        </div>

        {/* Conversation Search Filter */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-hairline)' }}>
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
            <Search size={13} color="var(--text-muted)" />
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
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Groups & Direct Messages Roster */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Section: Groups */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px 6px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
              }}
            >
              <span>Groups ({filteredChannels.length})</span>
              <button
                onClick={() => setCreateChannelModalOpen(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                + Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filteredChannels.map((c) => {
                const isActive = activeType === 'channel' && activeId === c.id;
                const hasHuddle = isHuddleActive && huddleChannelId === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveConversation(c.id, 'channel')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: isActive ? 'var(--surface-3)' : 'transparent',
                      border: isActive
                        ? '1px solid rgba(245, 158, 11, 0.3)'
                        : '1px solid transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {c.isPrivate ? (
                        <Lock size={13} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                      ) : (
                        <Hash size={13} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                      )}
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: isActive ? 600 : 500,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {hasHuddle && (
                        <span
                          title="Huddle Active"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            padding: '1px 5px',
                            background: 'rgba(245, 158, 11, 0.2)',
                            borderRadius: '4px',
                            fontSize: '9px',
                            color: 'var(--accent-primary)',
                            fontWeight: 700,
                          }}
                        >
                          <Mic size={9} />
                          <span>LIVE</span>
                        </span>
                      )}

                      {c.unreadCount > 0 && (
                        <span
                          style={{
                            background: 'var(--accent-primary)',
                            color: '#000000',
                            fontWeight: 700,
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '10px',
                          }}
                        >
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
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
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
              }}
            >
              <span>Direct Messages ({filteredDMs.length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filteredDMs.map((dm) => {
                const isActive = activeType === 'dm' && activeId === dm.id;

                return (
                  <button
                    key={dm.id}
                    onClick={() => setActiveConversation(dm.id, 'dm')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: isActive ? 'var(--surface-3)' : 'transparent',
                      border: isActive
                        ? '1px solid rgba(245, 158, 11, 0.3)'
                        : '1px solid transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <div style={{ position: 'relative' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'var(--surface-4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '10px',
                            color: 'var(--accent-primary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {dm.name.charAt(0)}
                        </div>
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '-1px',
                            right: '-1px',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            border: '1px solid var(--surface-1)',
                            background:
                              dm.status === 'online'
                                ? '#10b981'
                                : dm.status === 'away'
                                ? '#f59e0b'
                                : 'var(--text-muted)',
                          }}
                        />
                      </div>

                      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: isActive ? 600 : 500,
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}
                        >
                          {dm.name}
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}
                        >
                          {dm.role}
                        </div>
                      </div>
                    </div>

                    {dm.unreadCount > 0 && (
                      <span
                        style={{
                          background: 'var(--accent-primary)',
                          color: '#000000',
                          fontWeight: 700,
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '10px',
                        }}
                      >
                        {dm.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* User Presence Footer Bar */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border-hairline)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>
              You (Online)
            </span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            🎧 In Deep Focus
          </span>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN ACTIVE CONVERSATION CANVAS                                       */}
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
        {/* Top Header & WhatsApp-style Members Trigger */}
        <header
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-hairline)',
            background: 'rgba(24, 23, 21, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
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
                  onClick={() => setIsGroupInfoDrawerOpen(true)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary-subtle)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                  }}
                  title="Click to view Group info & members"
                >
                  <Hash size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1
                      onClick={() => setIsGroupInfoDrawerOpen(true)}
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        margin: 0,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                      title="Click to view Group info & members"
                    >
                      {activeChannel?.name || 'Group'}
                    </h1>

                    {/* WhatsApp UX: Interactive Members Pill */}
                    <button
                      type="button"
                      onClick={() => setIsGroupInfoDrawerOpen(true)}
                      className="btn btn-ghost"
                      style={{
                        fontSize: '11px',
                        color: 'var(--accent-primary)',
                        background: 'rgba(245, 158, 11, 0.12)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Click to view all members, call or message them directly"
                    >
                      <Users size={12} />
                      <span>{currentGroupMembers.length} members</span>
                    </button>
                  </div>
                  <p
                    onClick={() => setIsGroupInfoDrawerOpen(true)}
                    style={{
                      margin: '2px 0 0',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      maxWidth: '500px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer',
                    }}
                  >
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
                    fontSize: '13px',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {activeDM?.name.charAt(0) || 'U'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {activeDM?.name || 'Direct Message'}
                    </h1>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        background:
                          activeDM?.status === 'online'
                            ? 'rgba(16, 185, 129, 0.14)'
                            : 'rgba(245, 158, 11, 0.14)',
                        color:
                          activeDM?.status === 'online' ? '#10b981' : 'var(--accent-primary)',
                        border: '1px solid var(--border-hairline)',
                      }}
                    >
                      {activeDM?.status}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {activeDM?.role} &bull; {activeDM?.department}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Action Bar (Members button, Huddle, Mention Task, Pinned) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* WhatsApp UX: Dedicated Members button */}
            {activeType === 'channel' && (
              <button
                onClick={() => setIsGroupInfoDrawerOpen((prev) => !prev)}
                className="btn btn-secondary"
                style={{
                  fontSize: '11px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  background: isGroupInfoDrawerOpen ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-2)',
                  borderColor: isGroupInfoDrawerOpen ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  color: isGroupInfoDrawerOpen ? 'var(--accent-primary)' : 'var(--text-primary)',
                }}
                title="View Group Members, Call & Direct Message (WhatsApp Style)"
              >
                <Users size={13} color="var(--accent-primary)" />
                <span style={{ fontWeight: 600 }}>Members ({currentGroupMembers.length})</span>
              </button>
            )}

            {/* Start / Join Live Huddle Button */}
            <button
              onClick={() => {
                toggleHuddle(activeId);
                addToast({
                  type: 'info',
                  message: activeHuddle
                    ? 'Left voice huddle.'
                    : '🎙️ Joined Live Squad Huddle with spatial audio.',
                });
              }}
              className="btn btn-secondary"
              style={{
                fontSize: '11px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                background: activeHuddle
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)'
                  : 'var(--surface-2)',
                border: activeHuddle
                  ? '1px solid var(--accent-primary)'
                  : '1px solid var(--border-subtle)',
                color: activeHuddle ? 'var(--accent-primary)' : 'var(--text-primary)',
              }}
            >
              {activeHuddle ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '12px' }}>
                  <div className="huddle-wave-bar" style={{ height: '12px' }} />
                  <div className="huddle-wave-bar" style={{ height: '8px', animationDelay: '-0.2s' }} />
                  <div className="huddle-wave-bar" style={{ height: '14px', animationDelay: '-0.4s' }} />
                </div>
              ) : (
                <Mic size={13} color="var(--accent-primary)" />
              )}
              <span style={{ fontWeight: 600 }}>{activeHuddle ? 'Huddle Active' : 'Start Huddle'}</span>
            </button>

            {/* Mention Sprint Task Button */}
            <button
              onClick={() => setMentionTaskModalOpen(true)}
              className="btn btn-secondary"
              style={{
                fontSize: '11px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Hash size={13} color="var(--accent-primary)" />
              <span>Mention Task</span>
            </button>

            {/* Pinned Items Shortcut */}
            <button
              onClick={() => setIsPinnedDrawerOpen((prev) => !prev)}
              className="btn btn-ghost"
              style={{
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: isPinnedDrawerOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
              title="View Pinned Items"
            >
              <Pin size={13} />
              <span>Pinned</span>
            </button>
          </div>
        </header>

        {/* Active Huddle Floating Ribbon (When Active) */}
        {activeHuddle && (
          <div
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.16) 0%, rgba(32, 30, 27, 0.9) 100%)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span className="huddle-wave-bar" style={{ height: '14px' }} />
                <span className="huddle-wave-bar" style={{ height: '18px', animationDelay: '-0.3s' }} />
                <span className="huddle-wave-bar" style={{ height: '10px', animationDelay: '-0.6s' }} />
                <span className="huddle-wave-bar" style={{ height: '16px', animationDelay: '-0.1s' }} />
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Live Voice Huddle &bull; {activeChannel?.name || 'Session'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--accent-primary)', marginLeft: '8px' }}>
                  (3 in room: Sarah Jenkins talking...)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  setIsMicMuted((prev) => !prev);
                  addToast({ type: 'info', message: isMicMuted ? 'Microphone unmuted' : 'Microphone muted' });
                }}
                className="btn btn-ghost"
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: isMicMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: isMicMuted ? '#ef4444' : 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {isMicMuted ? <MicOff size={13} /> : <Mic size={13} />}
                <span>{isMicMuted ? 'Muted' : 'Speaking'}</span>
              </button>

              <button
                onClick={() => toggleHuddle(activeId)}
                className="btn btn-secondary"
                style={{
                  fontSize: '11px',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                }}
              >
                Leave
              </button>
            </div>
          </div>
        )}

        {/* Pinned Sprint War Room Goal Banner */}
        {activeChannel?.pinnedGoal && isPinnedBannerExpanded && (
          <div
            style={{
              padding: '8px 24px',
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, var(--surface-1) 100%)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <span
                style={{
                  padding: '2px 6px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  borderRadius: '4px',
                  letterSpacing: '0.04em',
                }}
              >
                PINNED GOAL
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeChannel.pinnedGoal}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Clock size={11} />
                <span>3h 45m left in sprint</span>
              </span>
              <button
                onClick={() => setIsPinnedBannerExpanded(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                title="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. MESSAGE STREAM                                                        */}
        {/* ========================================================================= */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Welcome Card */}
          <div
            style={{
              padding: '16px 20px',
              background: 'linear-gradient(180deg, var(--surface-2) 0%, var(--surface-1) 100%)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--accent-primary-subtle)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Welcome to {activeType === 'channel' ? `#${activeChannel?.name}` : activeDM?.name}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                Persistent squad space with audio voice notes, tagged manager sprint deliverables, and file uploads.
              </p>
            </div>
          </div>

          {/* Render Messages */}
          {currentMessages.map((msg) => {
            const isMe = msg.senderId === 'user-current';
            const isHovered = hoveredMessageId === msg.id;
            const replies = threadReplies[msg.id] || [];

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: isHovered ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                  transition: 'background var(--transition-fast)',
                }}
              >
                {/* Floating Message Quick-Actions Bar (On Hover) */}
                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '16px',
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '3px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: 'var(--shadow-md)',
                      zIndex: 10,
                    }}
                  >
                    <button
                      onClick={() => toggleReaction(msg.id, '👍', 'user-current')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}
                      title="React 👍"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => toggleReaction(msg.id, '🔥', 'user-current')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}
                      title="React 🔥"
                    >
                      🔥
                    </button>
                    <button
                      onClick={() => toggleReaction(msg.id, '🚀', 'user-current')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}
                      title="React 🚀"
                    >
                      🚀
                    </button>

                    <div style={{ width: '1px', height: '14px', background: 'var(--border-hairline)', margin: '0 2px' }} />

                    <button
                      onClick={() => setActiveThreadMessage(msg)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
                      title="Reply in Thread"
                    >
                      <Reply size={13} />
                    </button>
                    <button
                      onClick={() => {
                        toggleStarMessage(msg.id);
                        addToast({ type: 'info', message: msg.isStarred ? 'Unstarred message' : 'Starred message ⭐' });
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: msg.isStarred ? 'var(--accent-primary)' : 'var(--text-muted)',
                        padding: '2px 4px',
                      }}
                      title="Star Message"
                    >
                      <Bookmark size={13} fill={msg.isStarred ? 'var(--accent-primary)' : 'none'} />
                    </button>
                    <button
                      onClick={() => {
                        togglePinMessage(msg.id);
                        addToast({ type: 'info', message: msg.isPinned ? 'Unpinned message' : 'Pinned message to group 📌' });
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: msg.isPinned ? 'var(--accent-primary)' : 'var(--text-muted)',
                        padding: '2px 4px',
                      }}
                      title="Pin Message"
                    >
                      <Pin size={13} />
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        addToast({ type: 'success', message: 'Message copied to clipboard.' });
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
                      title="Copy Message Text"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                )}

                {/* Sender Avatar */}
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: isMe ? 'var(--accent-primary)' : 'var(--surface-3)',
                    color: isMe ? '#000000' : 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  {isMe ? 'YOU' : msg.senderName.charAt(0)}
                </div>

                {/* Content Column */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {msg.senderName}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: '4px' }}>
                      {msg.senderRole}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {msg.timestamp}
                    </span>

                    {msg.isPinned && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontWeight: 600,
                        }}
                      >
                        <Pin size={10} />
                        <span>Pinned</span>
                      </span>
                    )}

                    {msg.isStarred && (
                      <Bookmark size={11} fill="var(--accent-primary)" color="var(--accent-primary)" />
                    )}
                  </div>

                  {/* Text content */}
                  {msg.content && (
                    <div
                      style={{
                        fontSize: '13px',
                        lineHeight: 1.5,
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* SPICY: Interactive Voice Note Waveform Player */}
                  {msg.voiceNote && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, var(--surface-2) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxWidth: '460px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={() => {
                            if (playingVoiceId === msg.id) {
                              setPlayingVoiceId(null);
                            } else {
                              setPlayingVoiceId(msg.id);
                              setVoiceElapsedSec(0);
                            }
                          }}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'var(--accent-primary)',
                            border: 'none',
                            color: '#000000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)',
                          }}
                        >
                          {playingVoiceId === msg.id ? <Pause size={16} /> : <Play size={16} />}
                        </button>

                        {/* Frequency Waveform Bars */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3px', height: '28px' }}>
                          {msg.voiceNote.waveform.map((val, idx) => {
                            const isPlayed =
                              playingVoiceId === msg.id
                                ? idx / msg.voiceNote!.waveform.length <= voiceElapsedSec / 45
                                : false;

                            return (
                              <div
                                key={idx}
                                style={{
                                  flex: 1,
                                  height: `${Math.max(15, (val / 100) * 28)}px`,
                                  borderRadius: '2px',
                                  background: isPlayed
                                    ? 'var(--accent-primary)'
                                    : 'rgba(255, 245, 230, 0.25)',
                                  transition: 'background 0.15s ease',
                                }}
                              />
                            );
                          })}
                        </div>

                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, minWidth: '40px' }}>
                          {playingVoiceId === msg.id
                            ? `0:${voiceElapsedSec.toString().padStart(2, '0')}`
                            : msg.voiceNote.duration}
                        </span>
                      </div>

                      {msg.voiceNote.transcription && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                            paddingTop: '4px',
                            borderTop: '1px solid var(--border-hairline)',
                          }}
                        >
                          {msg.voiceNote.transcription}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SPICY: Interactive Embedded Sprint Task Cards */}
                  {msg.taggedTasks && msg.taggedTasks.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {msg.taggedTasks.map((task) => (
                        <div
                          key={task.id}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            background: 'var(--surface-2)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            maxWidth: '520px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: 'var(--accent-primary)',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {task.key}
                              </span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background:
                                    task.priority === 'urgent'
                                      ? 'rgba(244, 63, 94, 0.18)'
                                      : 'rgba(245, 158, 11, 0.18)',
                                  color:
                                    task.priority === 'urgent' ? '#f43f5e' : 'var(--accent-primary)',
                                }}
                              >
                                {task.priority}
                              </span>
                              {task.storyPoints && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--text-muted)',
                                    background: 'var(--surface-3)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {task.storyPoints} SP
                                </span>
                              )}
                            </div>

                            <span
                              style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                textTransform: 'capitalize',
                              }}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>

                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {task.title}
                          </div>

                          {/* Progress bar on ticket card */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                flex: 1,
                                height: '4px',
                                borderRadius: '2px',
                                background: 'var(--surface-3)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: '75%',
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>75% done</span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '6px',
                              borderTop: '1px solid var(--border-hairline)',
                            }}
                          >
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Assigned by {task.assignedByManager} &bull; {task.assigneeName}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={(e) => handleQuickLog30m(task.key, e)}
                                className="btn btn-ghost"
                                style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  color: 'var(--accent-primary)',
                                  fontWeight: 600,
                                }}
                                title="Quick log 30 minutes to timesheet"
                              >
                                + Quick Log 30m
                              </button>

                              <button
                                onClick={() => handleInspectTask(task)}
                                className="btn btn-primary"
                                style={{
                                  fontSize: '11px',
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span>Inspect</span>
                                <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border-hairline)',
                            fontSize: '12px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <FileText size={16} color="var(--accent-primary)" />
                          <div>
                            <div style={{ fontWeight: 600 }}>{att.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{att.size}</div>
                          </div>
                          <button
                            onClick={() => addToast({ type: 'info', message: `Downloading ${att.name}...` })}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent-primary)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                            title="Download Attachment"
                          >
                            <Download size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reaction Pills & Quick Reaction Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {msg.reactions &&
                      msg.reactions.map((rx, idx) => {
                        const userReacted = rx.users.includes('user-current');
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleReaction(msg.id, rx.emoji, 'user-current')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: userReacted ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-2)',
                              border: userReacted
                                ? '1px solid var(--accent-primary)'
                                : '1px solid var(--border-hairline)',
                              color: 'var(--text-primary)',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{rx.emoji}</span>
                            <span style={{ fontWeight: 600, color: userReacted ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                              {rx.count}
                            </span>
                          </button>
                        );
                      })}

                    {/* Thread Replies Button */}
                    {(msg.threadRepliesCount || replies.length > 0) && (
                      <button
                        onClick={() => setActiveThreadMessage(msg)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: '2px 6px',
                        }}
                      >
                        <MessageSquare size={12} />
                        <span>
                          {replies.length > 0 ? replies.length : msg.threadRepliesCount} replies
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Live Typing Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
            <span>Sarah Jenkins is typing...</span>
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================================= */}
        {/* 4. LUXURY MESSAGE COMPOSER & FLOATING DOCK                                */}
        {/* ========================================================================= */}
        <footer
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-hairline)',
            background: 'rgba(24, 23, 21, 0.9)',
            backdropFilter: 'blur(20px)',
            position: 'relative',
          }}
        >
          {/* Slash Commands Auto-Suggest Floating Popover */}
          {isSlashMenuOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '24px',
                width: '320px',
                background: 'var(--surface-3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '6px',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginBottom: '8px',
                zIndex: 20,
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  padding: '4px 8px',
                }}
              >
                Quick Slash Commands
              </div>
              <button
                onClick={() => handleExecuteSlash('task')}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '6px 8px', gap: '8px', fontSize: '12px' }}
              >
                <Hash size={13} color="var(--accent-primary)" />
                <span>/task - Tag and link sprint deliverable</span>
              </button>
              <button
                onClick={() => handleExecuteSlash('huddle')}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '6px 8px', gap: '8px', fontSize: '12px' }}
              >
                <Mic size={13} color="var(--accent-primary)" />
                <span>/huddle - Start live squad voice huddle</span>
              </button>
              <button
                onClick={() => handleExecuteSlash('standup')}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '6px 8px', gap: '8px', fontSize: '12px' }}
              >
                <Clock size={13} color="var(--accent-primary)" />
                <span>/standup - Insert daily standup format</span>
              </button>
              <button
                onClick={() => handleExecuteSlash('kudos')}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '6px 8px', gap: '8px', fontSize: '12px' }}
              >
                <Sparkles size={13} color="var(--accent-primary)" />
                <span>/kudos - Celebrate teammate deliverable</span>
              </button>
            </div>
          )}

          {/* Staged Attachments & Tagged Tasks Tray */}
          {(stagedAttachments.length > 0 || stagedTaskTags.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {stagedTaskTags.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: 'var(--accent-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <Hash size={12} />
                  <span>
                    [{task.key}] {task.title.slice(0, 28)}...
                  </span>
                  <button
                    onClick={() => setStagedTaskTags((prev) => prev.filter((t) => t.id !== task.id))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
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

          {/* Floating Composer Frame */}
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
                  ? `Message #${activeChannel?.name}... (Type / for commands, Enter to send)`
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

            {/* Composer Action Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {/* Mention Task Button */}
                <button
                  type="button"
                  onClick={() => setMentionTaskModalOpen(true)}
                  className="btn btn-ghost"
                  style={{
                    padding: '5px 8px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '6px',
                    color: 'var(--accent-primary)',
                  }}
                  title="Mention sprint task (#)"
                >
                  <Hash size={13} />
                  <span>Task</span>
                </button>

                {/* Simulate Audio Voice Note Button */}
                <button
                  type="button"
                  onClick={handleRecordAudioMemo}
                  className="btn btn-ghost"
                  style={{
                    padding: '5px 8px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '6px',
                    color: 'var(--accent-primary)',
                  }}
                  title="Record Instant Audio Memo"
                >
                  <Mic size={13} />
                  <span>Voice Memo</span>
                </button>

                {/* File Attachment Trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-ghost"
                  style={{
                    padding: '5px 8px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '6px',
                  }}
                  title="Attach files or screenshots"
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

                {/* Quick Emoji Shortcuts */}
                <button
                  type="button"
                  onClick={() => setInputText((p) => p + ' 🚀')}
                  className="btn btn-ghost"
                  style={{ padding: '4px 6px', borderRadius: '6px', fontSize: '12px' }}
                  title="Add Rocket"
                >
                  🚀
                </button>
                <button
                  type="button"
                  onClick={() => setInputText((p) => p + ' 🔥')}
                  className="btn btn-ghost"
                  style={{ padding: '4px 6px', borderRadius: '6px', fontSize: '12px' }}
                  title="Add Fire"
                >
                  🔥
                </button>
                <button
                  type="button"
                  onClick={() => setInputText((p) => p + ' 👍')}
                  className="btn btn-ghost"
                  style={{ padding: '4px 6px', borderRadius: '6px', fontSize: '12px' }}
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

      {/* ========================================================================= */}
      {/* 5. WHATSAPP UX: GROUP INFO & MEMBERS DRAWER                                */}
      {/* ========================================================================= */}
      {isGroupInfoDrawerOpen && (
        <aside
          style={{
            width: '380px',
            borderLeft: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 20,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.06) 0%, transparent 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Group Info & Members
              </span>
            </div>
            <button
              onClick={() => setIsGroupInfoDrawerOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* WhatsApp Style Hero Group Profile Card */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div
              style={{
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                borderBottom: '1px solid var(--border-hairline)',
                background: 'linear-gradient(180deg, var(--surface-2) 0%, var(--surface-1) 100%)',
              }}
            >
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)',
                  border: '2px solid var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
                  marginBottom: '12px',
                }}
              >
                <Hash size={32} />
              </div>

              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                #{activeChannel?.name || 'engineering'}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Group &bull; {currentGroupMembers.length} participants
              </div>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginTop: '10px',
                  lineHeight: 1.4,
                  maxWidth: '300px',
                }}
              >
                {activeChannel?.topic}
              </p>

              {/* WhatsApp Quick Action Tiles (Audio Call, Video Call, Add) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '16px',
                }}
              >
                <button
                  onClick={() => {
                    toggleHuddle(activeId);
                    addToast({ type: 'info', message: '🎙️ Group Voice Huddle launched.' });
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    width: '80px',
                  }}
                >
                  <Phone size={15} color="var(--accent-primary)" />
                  <span>Audio Call</span>
                </button>

                <button
                  onClick={() => {
                    addToast({ type: 'info', message: '📹 Group Video Call room created.' });
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    width: '80px',
                  }}
                >
                  <Video size={15} color="var(--accent-primary)" />
                  <span>Video Call</span>
                </button>

                <button
                  onClick={() => {
                    addToast({ type: 'info', message: 'Invite link copied to clipboard.' });
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    width: '80px',
                  }}
                >
                  <UserPlus size={15} color="var(--accent-primary)" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Shared Media / Links / Docs summary */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-2)',
                cursor: 'pointer',
              }}
              onClick={() => setIsPinnedDrawerOpen(true)}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Media, Links and Docs
              </span>
              <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                18 Files &gt;
              </span>
            </div>

            {/* Participants Section Header */}
            <div style={{ padding: '16px 20px 8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {filteredGroupMembers.length} Participants
                </span>
                <span style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>
                  Click icon to Call or DM
                </span>
              </div>

              {/* Member Search Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  marginBottom: '12px',
                }}
              >
                <Search size={13} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search participants by name or role..."
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

              {/* Members List with WhatsApp-Style Direct Action Buttons */}
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
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-hairline)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Avatar & Member Details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <div style={{ position: 'relative' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: isCurrent ? 'var(--accent-primary)' : 'var(--surface-3)',
                              color: isCurrent ? '#000000' : 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              border: '1px solid var(--border-subtle)',
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
                              background:
                                member.status === 'online'
                                  ? '#10b981'
                                  : member.status === 'away'
                                  ? '#f59e0b'
                                  : 'var(--text-muted)',
                              border: '1px solid var(--surface-2)',
                            }}
                          />
                        </div>

                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {member.name}
                            </span>

                            {member.isAdmin && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(245, 158, 11, 0.2)',
                                  color: 'var(--accent-primary)',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                }}
                              >
                                Group Admin
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              marginTop: '1px',
                            }}
                          >
                            {member.customStatus || member.role}
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp UX Action Controls: Message & Call */}
                      {!isCurrent && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {/* Direct Message (DM) */}
                          <button
                            onClick={() => handleDirectMessageMember(member)}
                            className="btn btn-ghost"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '8px',
                              background: 'var(--surface-3)',
                              color: 'var(--accent-primary)',
                            }}
                            title={`Send direct message to ${member.name}`}
                          >
                            <MessageSquare size={13} />
                          </button>

                          {/* Direct Voice Call */}
                          <button
                            onClick={() => handleStartCallMember(member, 'voice')}
                            className="btn btn-ghost"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '8px',
                              background: 'var(--surface-3)',
                              color: '#10b981',
                            }}
                            title={`Direct voice call ${member.name}`}
                          >
                            <Phone size={13} />
                          </button>

                          {/* Direct Video Call */}
                          <button
                            onClick={() => handleStartCallMember(member, 'video')}
                            className="btn btn-ghost"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '8px',
                              background: 'var(--surface-3)',
                              color: 'var(--text-muted)',
                            }}
                            title={`Direct video call ${member.name}`}
                          >
                            <Video size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
            zIndex: 10,
          }}
        >
          {/* Thread Header */}
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

          {/* Original Parent Message Card */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-hairline)',
              background: 'var(--surface-2)',
            }}
          >
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

          {/* Thread Replies List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {(threadReplies[activeThreadMessage.id] || []).map((reply) => (
              <div key={reply.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {reply.senderName}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{reply.time}</span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-2)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                  }}
                >
                  {reply.text}
                </div>
              </div>
            ))}
          </div>

          {/* Thread Reply Composer */}
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
              <button
                onClick={handleSendThreadReply}
                className="btn btn-primary"
                style={{ padding: '7px 12px', borderRadius: '8px' }}
              >
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
            zIndex: 10,
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
                Pinned in Group
              </span>
            </div>
            <button
              onClick={() => setIsPinnedDrawerOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                padding: '12px',
                background: 'var(--surface-2)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                📌 SPRINT WAR ROOM GOAL
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                {activeChannel?.pinnedGoal || 'Zero-downtime blue-green release at 18:00 IST'}
              </p>
            </div>

            <div
              style={{
                padding: '12px',
                background: 'var(--surface-2)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                📄 System Architecture Spec
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                Attached by Rohan Deshmukh &bull; 2.4 MB PDF
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 8. MENTION SPRINT TASK MODAL                                              */}
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
            {/* Modal Header */}
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

            {/* Task Search Bar */}
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

            {/* Task List */}
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
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: 'var(--accent-primary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {task.key}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background:
                          task.priority === 'urgent'
                            ? 'rgba(244, 63, 94, 0.18)'
                            : 'rgba(245, 158, 11, 0.18)',
                        color:
                          task.priority === 'urgent' ? '#f43f5e' : 'var(--accent-primary)',
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
