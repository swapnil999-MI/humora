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
  CheckCheck,
  Zap,
  Phone,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  ShieldCheck,
  MoreVertical,
  Camera,
  Folder,
  ChevronDown,
  CornerDownRight,
  Bell,
  BellOff,
  Star,
  Maximize2,
  RotateCcw,
  CheckSquare,
  TrendingUp,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import {
  usePulseStore,
  PulseAttachment,
  PulseTaskTag,
  PulseMessage,
  PulseVoiceNote,
  PulseChannel,
  PulseDirectMessage,
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

  // Right-Side Task Inspector & Sprint Tasks Drawer States
  const [inspectedTask, setInspectedTask] = useState<PulseTaskTag | null>(null);
  const [isTasksListDrawerOpen, setIsTasksListDrawerOpen] = useState(false);
  const [taskActiveTab, setTaskActiveTab] = useState<'overview' | 'worklogs' | 'activity'>('overview');
  const [taskStopwatchRunning, setTaskStopwatchRunning] = useState(false);
  const [taskStopwatchSeconds, setTaskStopwatchSeconds] = useState(0);
  const taskTimerRef = useRef<any>(null);

  // Dynamic status & logged hours map for tasks
  const [taskStatusMap, setTaskStatusMap] = useState<Record<string, 'todo' | 'in_progress' | 'review' | 'done'>>({
    'task-pay-101': 'in_progress',
    'task-eng-204': 'review',
    'task-ux-302': 'done',
    'task-api-105': 'todo',
  });

  const [taskHoursLogged, setTaskHoursLogged] = useState<Record<string, number>>({
    'task-pay-101': 3.5,
    'task-eng-204': 6.0,
    'task-ux-302': 2.5,
    'task-api-105': 1.0,
  });

  const [taskWorklogEntries, setTaskWorklogEntries] = useState<
    Record<string, Array<{ id: string; time: string; hours: number; desc: string; user: string }>>
  >({
    'task-pay-101': [
      { id: 'wl-1', time: '10:30 AM', hours: 2.0, desc: 'Biometric shift LOP algorithm test cases', user: 'Rohan Deshmukh' },
      { id: 'wl-2', time: '02:15 PM', hours: 1.5, desc: 'Section 115BAC TDS tax bracket formulas', user: 'Rohan Deshmukh' },
    ],
    'task-eng-204': [
      { id: 'wl-3', time: '09:00 AM', hours: 3.5, desc: 'Fiber v2 connection pool refactor', user: 'Alex Rivera' },
      { id: 'wl-4', time: '01:45 PM', hours: 2.5, desc: 'Database keep-alive ping optimization', user: 'Alex Rivera' },
    ],
  });
  const [activeCallPartner, setActiveCallPartner] = useState<{
    name: string;
    role: string;
    type: 'voice' | 'video';
  } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);

  // Audio note playback simulation
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceElapsedSec, setVoiceElapsedSec] = useState(18);

  // Thread discussion drawer
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

  // Voice note playback timer
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

  // Task Inspector live stopwatch timer
  useEffect(() => {
    if (taskStopwatchRunning) {
      taskTimerRef.current = setInterval(() => {
        setTaskStopwatchSeconds((prev) => prev + 1);
      }, 1000);
    } else if (taskTimerRef.current) {
      clearInterval(taskTimerRef.current);
    }
    return () => {
      if (taskTimerRef.current) clearInterval(taskTimerRef.current);
    };
  }, [taskStopwatchRunning]);

  const formatSeconds = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine active conversation details
  const activeChannel = channels.find((c) => c.id === activeId);
  const activeDM = directMessages.find((dm) => dm.id === activeId);

  // WhatsApp Squad Members Data Roster
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
  const displayMessages = inChatSearchQuery.trim()
    ? currentMessages.filter((m) =>
        m.content.toLowerCase().includes(inChatSearchQuery.toLowerCase())
      )
    : currentMessages;

  // Send message handler
  const handleSend = () => {
    if (!inputText.trim() && stagedAttachments.length === 0 && stagedTaskTags.length === 0) return;

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
    setIsAttachMenuOpen(false);
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

  // Simulate Instant Audio Memo Recording (WhatsApp Mic Button)
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
    sendMessage(activeId, '', [], [], voiceNote);
    addToast({ type: 'success', message: '🎙️ Voice note recorded & sent.' });
  };

  // WhatsApp UX: Direct Message a Member
  const handleDirectMessageMember = (member: GroupMember) => {
    setIsInfoDrawerOpen(false);
    if (member.dmId) {
      setActiveConversation(member.dmId, 'dm');
      addToast({ type: 'success', message: `Switched to direct chat with ${member.name}.` });
    } else {
      addToast({
        type: 'info',
        message: `Direct message thread initialized for ${member.name}.`,
      });
    }
  };

  // WhatsApp UX: Start Call with Member
  const handleStartCallMember = (partner: { name: string; role: string }, type: 'voice' | 'video') => {
    setActiveCallPartner({ name: partner.name, role: partner.role, type });
    addToast({
      type: 'info',
      message: `📞 Calling ${partner.name} (${type === 'voice' ? 'Voice Call' : 'Video Call'})...`,
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

  // Open right-side Task Inspector drawer
  const handleInspectTask = (task: PulseTaskTag) => {
    setIsInfoDrawerOpen(false);
    setIsPinnedDrawerOpen(false);
    setIsTasksListDrawerOpen(false);
    setActiveThreadMessage(null);

    setInspectedTask(task);
    setTaskActiveTab('overview');
    setTaskStopwatchRunning(false);
    setTaskStopwatchSeconds(0);
  };

  // Expand from right-side Task Inspector to full-screen Kanban IssueDrawer
  const handleExpandToFullModal = (task: PulseTaskTag) => {
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
        description: `Task tagged from Team Pulse conversation.\n\nManager: ${task.assignedByManager}\nStatus: ${taskStatusMap[task.id] || task.status}`,
        issue_type: 'task',
        status_id: 'status-todo',
        status_name: taskStatusMap[task.id] || task.status,
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

  // Quick Log Time to Sprint Task
  const handleQuickLogTime = (taskId: string, hoursToAdd: number, taskKey: string) => {
    setTaskHoursLogged((prev) => ({
      ...prev,
      [taskId]: Number(((prev[taskId] || 0) + hoursToAdd).toFixed(2)),
    }));
    const newEntry = {
      id: `wl-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hours: hoursToAdd,
      desc: `Quick logged +${hoursToAdd}h from Team Pulse task inspector`,
      user: 'Rohan Deshmukh (You)',
    };
    setTaskWorklogEntries((prev) => ({
      ...prev,
      [taskId]: [newEntry, ...(prev[taskId] || [])],
    }));
    addToast({
      type: 'success',
      message: `+${hoursToAdd >= 1 ? `${hoursToAdd}h` : `${Math.round(hoursToAdd * 60)}m`} logged to ${taskKey} & synced with Timesheet Ledger!`,
    });
  };

  // Update Status for Sprint Task
  const handleUpdateTaskStatus = (taskId: string, newStatus: 'todo' | 'in_progress' | 'review' | 'done', taskKey: string) => {
    setTaskStatusMap((prev) => ({
      ...prev,
      [taskId]: newStatus,
    }));
    addToast({
      type: 'info',
      message: `${taskKey} status updated to ${newStatus.replace('_', ' ').toUpperCase()}!`,
    });
  };

  // Post Task Progress Update directly to Chat Stream
  const handlePostTaskUpdateToChat = (task: PulseTaskTag) => {
    const currentHours = taskHoursLogged[task.id] || 3.5;
    const currentStatus = taskStatusMap[task.id] || task.status;
    const updateText = `⚡ Update on ${task.key} (${task.title}): Status is [${currentStatus.replace('_', ' ').toUpperCase()}]. Total logged: ${currentHours}h. Biometric sync active.`;

    if (activeType === 'channel' && activeChannel) {
      sendMessage(activeChannel.id, updateText);
    } else if (activeDM) {
      sendMessage(activeDM.id, updateText);
    }
    addToast({
      type: 'success',
      message: `Posted update for ${task.key} to ${activeType === 'channel' ? `#${activeChannel?.name}` : activeDM?.name || 'chat'}!`,
    });
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
                PeopleOS Team Pulse
              </span>
            </div>
          </div>

          {/* Right Action Icons (Moments/Status, New Group, Menu) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            <button
              onClick={() => addToast({ type: 'info', message: 'Team Presence Radar active.' })}
              className="btn btn-ghost"
              style={{ padding: '7px', borderRadius: '50%', color: 'var(--text-muted)' }}
              title="Team Status & Radar"
            >
              <Radio size={18} />
            </button>

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
                <button
                  onClick={() => {
                    setIsSidebarMenuOpen(false);
                    addToast({ type: 'info', message: 'Notification preferences saved.' });
                  }}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
                >
                  Chat Settings
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

            const timeDisplay = isGroup
              ? (item as any).createdAt === '2026-02-15'
                ? 'Yesterday'
                : '10:42 AM'
              : (item as any).lastMessageTime || 'Yesterday';

            const snippet = isGroup
              ? (item as any).topic
              : (item as any).lastMessageSnippet || 'Hey team!';

            return (
              <div
                key={item.id}
                onClick={() => {
                  setActiveConversation(item.id, isGroup ? 'channel' : 'dm');
                }}
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
                      {/* WhatsApp Double Checkmark icon on snippet */}
                      <CheckCheck size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
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
                {activeType === 'channel' ? `#${activeChannel?.name}` : activeDM?.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {activeType === 'channel'
                  ? 'Sarah, Alex, Rohan, Priya, You, Vikram...'
                  : activeDM?.status === 'online'
                  ? 'online'
                  : 'last seen today at 10:42 AM'}
              </div>
            </div>
          </div>

          {/* Right Action Icons: Video, Voice Call, In-Chat Search, Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            {/* Video Call Button */}
            <button
              onClick={() =>
                handleStartCallMember(
                  { name: activeType === 'channel' ? activeChannel?.name || 'Group' : activeDM?.name || 'Contact', role: 'Live Session' },
                  'video'
                )
              }
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: '50%', color: 'var(--text-muted)' }}
              title="Video Call"
            >
              <Video size={18} />
            </button>

            {/* Voice Call Button */}
            <button
              onClick={() =>
                handleStartCallMember(
                  { name: activeType === 'channel' ? activeChannel?.name || 'Group' : activeDM?.name || 'Contact', role: 'Voice Call' },
                  'voice'
                )
              }
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: '50%', color: 'var(--text-muted)' }}
              title="Voice Call"
            >
              <Phone size={17} />
            </button>

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
                    setIsTasksListDrawerOpen(true);
                    setInspectedTask(null);
                  }}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px', color: 'var(--accent-primary)' }}
                >
                  ⚡ Sprint Tasks Roster
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
                <button
                  onClick={() => {
                    setIsChatHeaderMenuOpen(false);
                    addToast({ type: 'info', message: 'Chat notifications muted for 8 hours.' });
                  }}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
                >
                  Mute Notifications
                </button>
                <button
                  onClick={() => {
                    setIsChatHeaderMenuOpen(false);
                    addToast({ type: 'info', message: 'Chat cleared.' });
                  }}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px', color: '#ef4444' }}
                >
                  Clear Messages
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
          {/* Floating WhatsApp Date Separator Pill */}
          <div className="whatsapp-date-pill">
            TODAY
          </div>

          {/* Render Messages in WhatsApp Bubbles */}
          {displayMessages.map((msg) => {
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
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => toggleReaction(msg.id, '❤️', 'user-current')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      ❤️
                    </button>
                    <button
                      onClick={() => toggleReaction(msg.id, '🔥', 'user-current')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      🔥
                    </button>
                    <button
                      onClick={() => toggleReaction(msg.id, '🚀', 'user-current')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      🚀
                    </button>
                    <button
                      onClick={() => setActiveThreadMessage(msg)}
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
                        onClick={() => {
                          if (playingVoiceId === msg.id) setPlayingVoiceId(null);
                          else {
                            setPlayingVoiceId(msg.id);
                            setVoiceElapsedSec(0);
                          }
                        }}
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
                              ? idx / msg.voiceNote!.waveform.length <= voiceElapsedSec / 45
                              : false;

                          return (
                            <div
                              key={idx}
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
                          ? `0:${voiceElapsedSec.toString().padStart(2, '0')}`
                          : msg.voiceNote.duration}
                      </span>
                    </div>
                  )}

                  {/* Embedded Task Card in Bubble */}
                  {msg.taggedTasks && msg.taggedTasks.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {msg.taggedTasks.map((task) => {
                        const status = taskStatusMap[task.id] || task.status;
                        const hours = taskHoursLogged[task.id] || 3.5;
                        const isUrgent = task.priority === 'urgent';
                        const progressPct = Math.min(100, Math.round((hours / 8.0) * 100));

                        return (
                          <div key={task.id} className="whatsapp-task-card">
                            {/* Top row: Key, Status & Priority */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    color: 'var(--accent-primary)',
                                    fontFamily: 'var(--font-mono)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <Zap size={11} color="var(--accent-primary)" />
                                  {task.key}
                                </span>
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: 'var(--accent-primary)',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {status.replace('_', ' ')}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  color: isUrgent ? '#f43f5e' : 'var(--accent-primary)',
                                  textTransform: 'uppercase',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                {isUrgent && <Flame size={10} />}
                                {task.priority}
                              </span>
                            </div>

                            {/* Title */}
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: '6px' }}>
                              {task.title}
                            </div>

                            {/* Biometric timesheet progress bar */}
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                                <span>Logged: {hours}h / 8h</span>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{progressPct}% Synced</span>
                              </div>
                              <div style={{ height: '4px', width: '100%', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${progressPct}%`,
                                    background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                                    borderRadius: '2px',
                                  }}
                                />
                              </div>
                            </div>

                            {/* Manager attribution & 3 Soft UI Action buttons */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {task.assignedByManager}
                              </span>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={(e) => handleQuickLog30m(task.key, e)}
                                  className="btn btn-ghost"
                                  style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', color: 'var(--accent-primary)', gap: '2px' }}
                                  title="Quick log 30m"
                                >
                                  <Clock size={11} />
                                  <span>+30m</span>
                                </button>
                                <button
                                  onClick={() => setActiveThreadMessage(msg)}
                                  className="btn btn-ghost"
                                  style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '6px', color: 'var(--text-muted)' }}
                                  title="Discuss in thread"
                                >
                                  <Reply size={11} />
                                </button>
                                <button
                                  onClick={() => handleInspectTask(task)}
                                  className="btn btn-primary"
                                  style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '6px', gap: '3px' }}
                                >
                                  <Zap size={11} />
                                  <span>Inspect</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
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
                            onClick={() => addToast({ type: 'info', message: `Downloading ${att.name}...` })}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0 }}
                          >
                            <Download size={12} />
                          </button>
                        </div>
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

                    {/* WhatsApp Read Receipt Double Checkmark */}
                    {isMe && (
                      <CheckCheck size={13} color="var(--accent-primary)" />
                    )}
                  </div>
                </div>

                {/* Overlapping Reaction Tag Pill (WhatsApp Style) */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div
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
            );
          })}

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
              onChange={(e) => setInputText(e.target.value)}
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
              className="btn btn-primary"
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
              className="btn btn-ghost"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                background: 'rgba(245, 158, 11, 0.12)',
                flexShrink: 0,
              }}
              title="Click to send audio voice memo"
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
                {activeType === 'channel' ? `#${activeChannel?.name}` : activeDM?.name}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {activeType === 'channel'
                  ? `Group &bull; ${currentGroupMembers.length} participants`
                  : `${activeDM?.role} &bull; ${activeDM?.department}`}
              </div>

              {/* WhatsApp Quick Action Tiles (Call, Video, Search) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={() =>
                    handleStartCallMember(
                      { name: activeType === 'channel' ? activeChannel?.name || 'Group' : activeDM?.name || 'Contact', role: 'Voice' },
                      'voice'
                    )
                  }
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
                  <Phone size={15} color="var(--accent-primary)" />
                  <span>Audio</span>
                </button>

                <button
                  onClick={() =>
                    handleStartCallMember(
                      { name: activeType === 'channel' ? activeChannel?.name || 'Group' : activeDM?.name || 'Contact', role: 'Video' },
                      'video'
                    )
                  }
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
                  <Video size={15} color="var(--accent-primary)" />
                  <span>Video</span>
                </button>

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
                {activeType === 'channel' ? activeChannel?.topic : activeDM?.lastMessageSnippet || 'In Deep Flow 🎧'}
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

            {/* Group Sprint Tasks Section */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '8px solid var(--surface-0)',
                background: 'var(--surface-1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setIsInfoDrawerOpen(false);
                  setIsTasksListDrawerOpen(true);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={15} color="var(--accent-primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Group Sprint Tasks
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {availableSprintTasks.length} Tasks &gt;
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableSprintTasks.slice(0, 3).map((task) => {
                  const status = taskStatusMap[task.id] || task.status;
                  const hours = taskHoursLogged[task.id] || 3.5;
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleInspectTask(task)}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                          {task.key}
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                          {status.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <span>{task.assignedByManager.split(' ')[0]}</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{hours}h logged • Inspect &rarr;</span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                            <button
                              onClick={() => handleStartCallMember(member, 'voice')}
                              className="btn btn-ghost"
                              style={{ padding: '6px', borderRadius: '6px', color: '#10b981' }}
                              title="Voice call"
                            >
                              <Phone size={13} />
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
            {(threadReplies[activeThreadMessage.id] || []).map((reply) => (
              <div key={reply.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {reply.senderName}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{reply.time}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: '8px' }}>
                  {reply.text}
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

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                📌 SPRINT WAR ROOM GOAL
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                {activeChannel?.pinnedGoal || 'Zero-downtime blue-green release at 18:00 IST'}
              </p>
            </div>

            <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
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
      {/* 8. SPRINT TASKS ROSTER DRAWER (RIGHT SIDE)                                */}
      {/* ========================================================================= */}
      {isTasksListDrawerOpen && !inspectedTask && (
        <aside
          style={{
            width: '390px',
            borderLeft: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 35,
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.45)',
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
              background: 'var(--surface-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={15} color="var(--accent-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Group Sprint Tasks
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: 'var(--accent-primary)',
                  borderRadius: '10px',
                  padding: '1px 6px',
                }}
              >
                {availableSprintTasks.length}
              </span>
            </div>
            <button
              onClick={() => setIsTasksListDrawerOpen(false)}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--text-muted)' }}
              title="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Subtitle */}
          <div style={{ padding: '12px 18px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Manager-assigned deliverables for this squad. Click any task to inspect details, log hours, or run the focus stopwatch.
            </div>
          </div>

          {/* Task List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {availableSprintTasks.map((task) => {
              const status = taskStatusMap[task.id] || task.status;
              const hours = taskHoursLogged[task.id] || 3.5;
              const isUrgent = task.priority === 'urgent';
              const progressPct = Math.min(100, Math.round((hours / 8.0) * 100));

              return (
                <div
                  key={task.id}
                  onClick={() => handleInspectTask(task)}
                  style={{
                    padding: '14px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isUrgent ? '#f43f5e' : 'var(--accent-primary)'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      {task.key}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isUrgent ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isUrgent ? '#f43f5e' : 'var(--accent-primary)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {status.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                    {task.title}
                  </div>

                  {/* Progress Mini-Bar */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      <span>{task.assignedByManager}</span>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{hours}h / 8h ({progressPct}%)</span>
                    </div>
                    <div style={{ height: '3px', width: '100%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${progressPct}%`,
                          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                          borderRadius: '2px',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 700, marginTop: '2px' }}>
                    <span>Inspect Task &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 9. DEDICATED RIGHT-SIDE TASK INSPECTOR DRAWER                              */}
      {/* ========================================================================= */}
      {inspectedTask && (
        <aside className="task-inspector-drawer">
          {/* Top Bar with Key, Expand & Close */}
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
              <button
                onClick={() => {
                  setInspectedTask(null);
                  setIsTasksListDrawerOpen(true);
                }}
                className="btn btn-ghost"
                style={{ padding: '4px 6px', color: 'var(--text-muted)' }}
                title="Back to Sprint Tasks list"
              >
                <ArrowLeft size={14} />
              </button>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                <Zap size={13} color="var(--accent-primary)" />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: 'var(--accent-primary)',
                  }}
                >
                  {inspectedTask.key}
                </span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: inspectedTask.priority === 'urgent' ? '#f43f5e' : 'var(--accent-primary)',
                  background: inspectedTask.priority === 'urgent' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {inspectedTask.priority}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => handleExpandToFullModal(inspectedTask)}
                className="btn btn-ghost"
                style={{ padding: '6px', color: 'var(--text-muted)' }}
                title="Open in full Kanban Issue Drawer"
              >
                <Maximize2 size={14} />
              </button>
              <button
                onClick={() => setInspectedTask(null)}
                className="btn btn-ghost"
                style={{ padding: '6px', color: 'var(--text-muted)' }}
                title="Close Inspector"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Tab Navigation (Overview, Timesheet Worklogs, Activity) */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-hairline)',
              background: 'var(--surface-1)',
              padding: '0 12px',
            }}
          >
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'worklogs', label: 'Worklogs & Sync' },
              { id: 'activity', label: 'Chat Context' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTaskActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: taskActiveTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: taskActiveTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview */}
          {taskActiveTab === 'overview' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Status Selector Bar */}
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Workflow Status
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {(['todo', 'in_progress', 'review', 'done'] as const).map((st) => {
                    const currentStatus = taskStatusMap[inspectedTask.id] || inspectedTask.status;
                    const isActive = currentStatus === st;
                    return (
                      <button
                        key={st}
                        onClick={() => handleUpdateTaskStatus(inspectedTask.id, st, inspectedTask.key)}
                        className={`task-status-pill ${isActive ? 'active' : ''}`}
                        style={{ justifyContent: 'center' }}
                      >
                        {isActive && <Check size={11} />}
                        <span>{st === 'in_progress' ? 'Prog' : st.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title & Description */}
              <div style={{ background: 'var(--surface-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {inspectedTask.title}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Sprint deliverable tagged in Team Pulse. Manager instructions require rigorous unit test coverage, zero biometric reconciliation variance, and compliance with statutory deduction rules.
                </p>
              </div>

              {/* Manager & Assignee Matrix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Assigned By Manager
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#000000',
                      }}
                    >
                      SJ
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {inspectedTask.assignedByManager}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        Sprint Lead
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Assignee
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--surface-4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {inspectedTask.assigneeName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {inspectedTask.assigneeName}
                      </div>
                      <div style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                        Online
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Biometric Attendance & Worklog Sync Meter */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 18, 15, 0.95) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} color="var(--accent-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                      Timesheet Worklog Sync
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    {taskHoursLogged[inspectedTask.id] || 3.5}h / 8.0h ({Math.round(((taskHoursLogged[inspectedTask.id] || 3.5) / 8.0) * 100)}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ height: '6px', width: '100%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(((taskHoursLogged[inspectedTask.id] || 3.5) / 8.0) * 100))}%`,
                      background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                {/* Quick Log Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Log:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { val: 0.25, label: '+15m' },
                      { val: 0.5, label: '+30m' },
                      { val: 1.0, label: '+1h' },
                      { val: 2.0, label: '+2h' },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        onClick={() => handleQuickLogTime(inspectedTask.id, btn.val, inspectedTask.key)}
                        className="task-quicklog-btn"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Integrated Live Work Stopwatch */}
              <div style={{ background: 'var(--surface-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={13} color="var(--accent-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                      Live Focus Stopwatch
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: taskStopwatchRunning ? '#10b981' : 'var(--text-primary)',
                    }}
                  >
                    {formatSeconds(taskStopwatchSeconds)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setTaskStopwatchRunning((p) => !p)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '7px 10px', fontSize: '11px', fontWeight: 700, gap: '6px' }}
                  >
                    {taskStopwatchRunning ? <Pause size={13} /> : <Play size={13} />}
                    <span>{taskStopwatchRunning ? 'Pause' : 'Start Timer'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setTaskStopwatchRunning(false);
                      setTaskStopwatchSeconds(0);
                    }}
                    className="btn btn-ghost"
                    style={{ padding: '7px 10px', color: 'var(--text-muted)' }}
                    title="Reset Stopwatch"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={() => {
                      if (taskStopwatchSeconds < 10) {
                        addToast({ type: 'info', message: 'Run timer for at least 10s to log session.' });
                        return;
                      }
                      const hrs = Math.max(0.1, parseFloat((taskStopwatchSeconds / 3600).toFixed(2)));
                      handleQuickLogTime(inspectedTask.id, hrs, inspectedTask.key);
                      setTaskStopwatchRunning(false);
                      setTaskStopwatchSeconds(0);
                    }}
                    className="btn btn-primary"
                    style={{ padding: '7px 12px', fontSize: '11px', fontWeight: 700 }}
                  >
                    Save Session
                  </button>
                </div>
              </div>

              {/* Agile Sprint Metrics */}
              <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sprint:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sprint 42 • Payment Cutover</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Story Points:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{inspectedTask.storyPoints || 5} SP</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Due Target:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Today at 18:00 IST</span>
                </div>
              </div>

              {/* Action Buttons: Post Update to Chat & Open Full Modal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => handlePostTaskUpdateToChat(inspectedTask)}
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '9px 14px', fontSize: '12px', fontWeight: 700, gap: '8px', color: 'var(--accent-primary)' }}
                >
                  <MessageSquare size={14} />
                  <span>Post Live Update to Chat</span>
                </button>
                <button
                  onClick={() => handleExpandToFullModal(inspectedTask)}
                  className="btn btn-ghost"
                  style={{ width: '100%', padding: '8px 14px', fontSize: '11px', color: 'var(--text-muted)', gap: '6px' }}
                >
                  <ExternalLink size={13} />
                  <span>Open in Full Agile Issue Drawer</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Timesheet Worklogs */}
          {taskActiveTab === 'worklogs' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Recorded Worklogs ({((taskWorklogEntries[inspectedTask.id] || []).length)})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(taskWorklogEntries[inspectedTask.id] || [
                  { id: 'wl-default-1', time: '11:00 AM', hours: 2.0, desc: 'Sprint task implementation and reconciliation test', user: 'Rohan Deshmukh' },
                  { id: 'wl-default-2', time: '02:30 PM', hours: 1.5, desc: 'Code review comments and edge-case verification', user: 'Rohan Deshmukh' },
                ]).map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {entry.user}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                        +{entry.hours}h
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {entry.desc}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      Logged today at {entry.time} • Billable
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Chat Context */}
          {taskActiveTab === 'activity' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Linked Team Pulse Conversations
              </div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '4px' }}>
                  TAGGED IN CHAT
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  "Assigned by Sarah Jenkins in #{activeChannel?.name || 'sprint-war-room'} with priority {inspectedTask.priority}."
                </p>
              </div>
              <button
                onClick={() => handlePostTaskUpdateToChat(inspectedTask)}
                className="btn btn-primary"
                style={{ marginTop: '10px', padding: '8px 12px', fontSize: '11px' }}
              >
                Send Thread Check-In
              </button>
            </div>
          )}
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
