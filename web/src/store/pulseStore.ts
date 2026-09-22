import { create } from 'zustand';

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
  waveform: number[];
  transcription?: string;
}

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
  isPinned?: boolean;
  isStarred?: boolean;
}

export interface PulseChannel {
  id: string;
  name: string;
  topic: string;
  isPrivate: boolean;
  memberCount: number;
  unreadCount: number;
  createdAt: string;
  pinnedGoal?: string;
}

export interface PulseDirectMessage {
  id: string; // Partner's user ID or DM ID
  userId: string;
  name: string;
  avatar?: string;
  role: string;
  department: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  statusCustom?: string;
  lastSeen?: string;
  unreadCount: number;
  lastMessageSnippet?: string;
  lastMessageTime?: string;
}

export interface PulseState {
  activeType: 'channel' | 'dm';
  activeId: string;
  searchQuery: string;
  channels: PulseChannel[];
  directMessages: PulseDirectMessage[];
  messages: Record<string, PulseMessage[]>; // conversationId -> messages
  isCreateChannelModalOpen: boolean;
  isMentionTaskModalOpen: boolean;
  isHuddleActive: boolean;
  huddleChannelId: string | null;
  activeThreadMessage: PulseMessage | null;

  // Actions
  setActiveConversation: (id: string, type: 'channel' | 'dm') => void;
  setSearchQuery: (query: string) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    attachments?: PulseAttachment[],
    taggedTasks?: PulseTaskTag[],
    voiceNote?: PulseVoiceNote
  ) => void;
  toggleReaction: (messageId: string, emoji: string, currentUserId: string) => void;
  toggleStarMessage: (messageId: string) => void;
  togglePinMessage: (messageId: string) => void;
  toggleHuddle: (channelId: string) => void;
  setActiveThreadMessage: (message: PulseMessage | null) => void;
  createChannel: (name: string, topic: string, isPrivate: boolean) => void;
  setCreateChannelModalOpen: (open: boolean) => void;
  setMentionTaskModalOpen: (open: boolean) => void;
}

const initialChannels: PulseChannel[] = [
  {
    id: 'chan-general',
    name: 'general',
    topic: 'Company-wide announcements, townhalls, and watercooler conversations',
    isPrivate: false,
    memberCount: 48,
    unreadCount: 0,
    createdAt: '2026-01-01',
    pinnedGoal: 'Annual All-Hands Q3 sync scheduled for Friday 4:00 PM IST',
  },
  {
    id: 'chan-engineering',
    name: 'engineering',
    topic: 'Platform architecture, Go backend APIs, frontend sprint delivery & DevOps',
    isPrivate: false,
    memberCount: 22,
    unreadCount: 3,
    createdAt: '2026-01-10',
    pinnedGoal: 'Release v2.4 production freeze at 18:00 IST | Zero-downtime blue-green cutover',
  },
  {
    id: 'chan-product-design',
    name: 'product-design',
    topic: 'UI/UX detailing, design tokens, Figma prototypes, and user experience reviews',
    isPrivate: false,
    memberCount: 14,
    unreadCount: 0,
    createdAt: '2026-02-01',
    pinnedGoal: 'Champagne Amber Gold luxury token audit complete',
  },
  {
    id: 'chan-sprint-room',
    name: 'sprint-war-room',
    topic: 'Active sprint milestones, task assignments, blockers, and ticket reconciliation',
    isPrivate: false,
    memberCount: 18,
    unreadCount: 1,
    createdAt: '2026-02-15',
    pinnedGoal: 'Sprint 24 War Room: 0 members in burnout risk | Target 42 SP',
  },
];

const initialDMs: PulseDirectMessage[] = [
  {
    id: 'dm-sarah',
    userId: 'user-sarah',
    name: 'Sarah Jenkins',
    role: 'VP of Engineering',
    department: 'Engineering Leadership',
    status: 'online',
    unreadCount: 1,
    lastMessageSnippet: 'Please verify the ticket PAY-101 before payroll sign-off.',
    lastMessageTime: '10:42 AM',
  },
  {
    id: 'dm-alex',
    userId: 'user-alex',
    name: 'Alex Rivera',
    role: 'Staff Lead Engineer',
    department: 'Core Architecture',
    status: 'online',
    unreadCount: 0,
    lastMessageSnippet: 'The new Go biometrics engine is running with 0 latency.',
    lastMessageTime: 'Yesterday',
  },
  {
    id: 'dm-priya',
    userId: 'user-priya',
    name: 'Priya Sharma',
    role: 'Principal Product Designer',
    department: 'Product Design',
    status: 'busy',
    unreadCount: 0,
    lastMessageSnippet: 'The Champagne Amber Gold color palette looks stunning in dark mode!',
    lastMessageTime: 'Sep 21',
  },
  {
    id: 'dm-rohan',
    userId: 'user-rohan',
    name: 'Rohan Deshmukh',
    role: 'Senior Fullstack Engineer',
    department: 'Frontend Engineering',
    status: 'away',
    unreadCount: 0,
    lastMessageSnippet: 'Just submitted the weekly worklog timesheet.',
    lastMessageTime: 'Sep 20',
  },
];

const initialMessages: Record<string, PulseMessage[]> = {
  'chan-engineering': [
    {
      id: 'msg-eng-1',
      conversationId: 'chan-engineering',
      senderId: 'user-alex',
      senderName: 'Alex Rivera',
      senderRole: 'Staff Lead Engineer',
      content: 'Morning team! We have finalized the architecture restructuring for PeopleOS. Go backend is isolated, and frontend is running with zero bundle warnings.',
      timestamp: '09:15 AM',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      reactions: [
        { emoji: '🚀', count: 4, users: ['user-sarah', 'user-rohan'] },
        { emoji: '👍', count: 3, users: ['user-priya'] },
      ],
    },
    {
      id: 'msg-eng-2',
      conversationId: 'chan-engineering',
      senderId: 'user-sarah',
      senderName: 'Sarah Jenkins',
      senderRole: 'VP of Engineering',
      content: 'Great work Alex. I have assigned the payroll compliance sprint tickets for Q3 review. Please check this deliverable:',
      timestamp: '09:32 AM',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      taggedTasks: [
        {
          id: 'task-pay-101',
          key: 'PAY-101',
          title: 'Implement Biometric LOP Deductions & IT Regime TDS Planner',
          status: 'in_progress',
          priority: 'urgent',
          assigneeName: 'Rohan Deshmukh',
          assignedByManager: 'Sarah Jenkins',
          storyPoints: 5,
        },
      ],
      reactions: [{ emoji: '👀', count: 2, users: ['user-rohan'] }],
    },
    {
      id: 'msg-eng-3',
      conversationId: 'chan-engineering',
      senderId: 'user-rohan',
      senderName: 'Rohan Deshmukh',
      senderRole: 'Senior Fullstack Engineer',
      content: 'On it! I have also verified the weekly worklog-to-timesheet reconciliation table. Here is the verified system architecture document for the team review.',
      timestamp: '10:05 AM',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      attachments: [
        {
          id: 'att-arch-1',
          name: 'PeopleOS_System_Architecture_2026.pdf',
          size: '2.4 MB',
          type: 'pdf',
          url: '#',
        },
      ],
      reactions: [{ emoji: '🔥', count: 3, users: ['user-alex', 'user-sarah'] }],
      threadRepliesCount: 2,
    },
    {
      id: 'msg-eng-voice-1',
      conversationId: 'chan-engineering',
      senderId: 'user-sarah',
      senderName: 'Sarah Jenkins',
      senderRole: 'VP of Engineering',
      content: 'Quick 45s audio memo on today\'s production release checklist and cutover schedule:',
      timestamp: '10:12 AM',
      createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      voiceNote: {
        duration: '0:45',
        waveform: [25, 45, 60, 85, 40, 75, 95, 100, 65, 45, 80, 90, 70, 50, 65, 85, 90, 40, 60, 75, 55, 35, 45, 25],
        transcription: 'Team, please ensure health probes pass before swapping NGINX blue-green upstreams.',
      },
      reactions: [{ emoji: '🔥', count: 4, users: ['user-rohan', 'user-alex'] }, { emoji: '🚀', count: 2, users: ['user-priya'] }],
      threadRepliesCount: 4,
      isPinned: true,
    },
  ],

  'chan-sprint-room': [
    {
      id: 'msg-sp-1',
      conversationId: 'chan-sprint-room',
      senderId: 'user-sarah',
      senderName: 'Sarah Jenkins',
      senderRole: 'VP of Engineering',
      content: 'Sprint 24 War Room is live. Team velocity is currently optimal, with 0 members in burnout sentinel high-risk tier. Please link any blockers directly below with task tags.',
      timestamp: '08:45 AM',
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      taggedTasks: [
        {
          id: 'task-eng-204',
          key: 'ENG-204',
          title: 'Optimize Fiber v2 Route Middleware & SQL Connection Pooling',
          status: 'review',
          priority: 'high',
          assigneeName: 'Alex Rivera',
          assignedByManager: 'Sarah Jenkins',
          storyPoints: 8,
        },
        {
          id: 'task-ux-302',
          key: 'UX-302',
          title: 'Standardize Soft Button Theme & Toast Notifications',
          status: 'done',
          priority: 'medium',
          assigneeName: 'Priya Sharma',
          assignedByManager: 'Sarah Jenkins',
          storyPoints: 3,
        },
      ],
      reactions: [{ emoji: '🎉', count: 5, users: ['user-alex', 'user-priya', 'user-rohan'] }],
    },
  ],

  'chan-product-design': [
    {
      id: 'msg-pd-1',
      conversationId: 'chan-product-design',
      senderId: 'user-priya',
      senderName: 'Priya Sharma',
      senderRole: 'Principal Product Designer',
      content: 'Here is the refined PeopleOS vector brand emblem preview in Champagne Amber Gold (#f59e0b) with negative space transparency. Thoughts on the subtle gradient curve?',
      timestamp: '11:20 AM',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      attachments: [
        {
          id: 'att-img-1',
          name: 'PeopleOS_Emblem_Gold_Preview.png',
          size: '840 KB',
          type: 'image',
          url: '/logo.svg',
          previewUrl: '/logo.svg',
        },
      ],
      reactions: [{ emoji: '❤️', count: 4, users: ['user-rohan', 'user-sarah'] }],
    },
  ],

  'chan-general': [
    {
      id: 'msg-gen-1',
      conversationId: 'chan-general',
      senderId: 'user-sarah',
      senderName: 'Sarah Jenkins',
      senderRole: 'VP of Engineering',
      content: 'Welcome to the PeopleOS Team Pulse collaboration space! You can now participate in team channels, direct message colleagues, share project files, and tag manager-assigned sprint tasks in any discussion.',
      timestamp: 'Yesterday at 5:30 PM',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      reactions: [{ emoji: '🎉', count: 8, users: ['user-alex', 'user-priya', 'user-rohan'] }],
    },
  ],

  'dm-sarah': [
    {
      id: 'msg-dm-s1',
      conversationId: 'dm-sarah',
      senderId: 'user-sarah',
      senderName: 'Sarah Jenkins',
      senderRole: 'VP of Engineering',
      content: 'Hi! I noticed your weekly timesheet reconciliation ledger is looking great. Could you please double check ticket PAY-101 before we lock the monthly payroll run?',
      timestamp: '10:40 AM',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      taggedTasks: [
        {
          id: 'task-pay-101',
          key: 'PAY-101',
          title: 'Implement Biometric LOP Deductions & IT Regime TDS Planner',
          status: 'in_progress',
          priority: 'urgent',
          assigneeName: 'You',
          assignedByManager: 'Sarah Jenkins',
          storyPoints: 5,
        },
      ],
      reactions: [{ emoji: '👍', count: 1, users: ['user-current'] }],
    },
    {
      id: 'msg-dm-s2',
      conversationId: 'dm-sarah',
      senderId: 'user-sarah',
      senderName: 'Sarah Jenkins',
      senderRole: 'VP of Engineering',
      content: 'Also, feel free to submit any broadband and learning claims under the FBP tab in your payroll desk.',
      timestamp: '10:42 AM',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
};

export const usePulseStore = create<PulseState>((set, get) => ({
  activeType: 'channel',
  activeId: 'chan-engineering',
  searchQuery: '',
  channels: initialChannels,
  directMessages: initialDMs,
  messages: initialMessages,
  isCreateChannelModalOpen: false,
  isMentionTaskModalOpen: false,
  isHuddleActive: false,
  huddleChannelId: null,
  activeThreadMessage: null,

  setActiveConversation: (id, type) => {
    set((state) => {
      // Clear unread counts for selected item
      const channels = state.channels.map((c) =>
        c.id === id ? { ...c, unreadCount: 0 } : c
      );
      const directMessages = state.directMessages.map((dm) =>
        dm.id === id ? { ...dm, unreadCount: 0 } : dm
      );
      return { activeId: id, activeType: type, channels, directMessages };
    });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  sendMessage: (conversationId, content, attachments = [], taggedTasks = [], voiceNote) => {
    if (!content.trim() && attachments.length === 0 && taggedTasks.length === 0 && !voiceNote) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMessage: PulseMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: 'user-current',
      senderName: 'You',
      senderRole: 'Senior Engineer',
      content,
      timestamp: timeString,
      createdAt: now.toISOString(),
      attachments: attachments.length > 0 ? attachments : undefined,
      taggedTasks: taggedTasks.length > 0 ? taggedTasks : undefined,
      voiceNote: voiceNote || undefined,
      reactions: [],
    };

    set((state) => {
      const existing = state.messages[conversationId] || [];
      const updatedMessages = {
        ...state.messages,
        [conversationId]: [...existing, newMessage],
      };

      // Update snippet on DM if applicable
      const directMessages = state.directMessages.map((dm) => {
        if (dm.id === conversationId) {
          return {
            ...dm,
            lastMessageSnippet: content.slice(0, 50),
            lastMessageTime: timeString,
          };
        }
        return dm;
      });

      return { messages: updatedMessages, directMessages };
    });
  },

  toggleReaction: (messageId, emoji, currentUserId = 'user-current') => {
    set((state) => {
      const activeMessages = state.messages[state.activeId] || [];
      const updatedList = activeMessages.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions ? [...msg.reactions] : [];
        const existingIdx = reactions.findIndex((r) => r.emoji === emoji);

        if (existingIdx >= 0) {
          const rx = reactions[existingIdx];
          const hasUser = rx.users.includes(currentUserId);
          if (hasUser) {
            // Remove user reaction
            const newUsers = rx.users.filter((u) => u !== currentUserId);
            if (newUsers.length === 0) {
              reactions.splice(existingIdx, 1);
            } else {
              reactions[existingIdx] = { ...rx, count: newUsers.length, users: newUsers };
            }
          } else {
            // Add user reaction
            reactions[existingIdx] = {
              ...rx,
              count: rx.count + 1,
              users: [...rx.users, currentUserId],
            };
          }
        } else {
          // New emoji reaction
          reactions.push({ emoji, count: 1, users: [currentUserId] });
        }

        return { ...msg, reactions };
      });

      return {
        messages: {
          ...state.messages,
          [state.activeId]: updatedList,
        },
      };
    });
  },

  toggleStarMessage: (messageId) => {
    set((state) => {
      const activeMessages = state.messages[state.activeId] || [];
      const updatedList = activeMessages.map((msg) =>
        msg.id === messageId ? { ...msg, isStarred: !msg.isStarred } : msg
      );
      return {
        messages: {
          ...state.messages,
          [state.activeId]: updatedList,
        },
      };
    });
  },

  togglePinMessage: (messageId) => {
    set((state) => {
      const activeMessages = state.messages[state.activeId] || [];
      const updatedList = activeMessages.map((msg) =>
        msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
      );
      return {
        messages: {
          ...state.messages,
          [state.activeId]: updatedList,
        },
      };
    });
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

  createChannel: (name, topic, isPrivate) => {
    const cleanName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const newChan: PulseChannel = {
      id: `chan-${Date.now()}`,
      name: cleanName,
      topic: topic || 'New collaboration space',
      isPrivate,
      memberCount: 1,
      unreadCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };

    set((state) => ({
      channels: [...state.channels, newChan],
      activeId: newChan.id,
      activeType: 'channel',
      isCreateChannelModalOpen: false,
    }));
  },

  setCreateChannelModalOpen: (open) => set({ isCreateChannelModalOpen: open }),
  setMentionTaskModalOpen: (open) => set({ isMentionTaskModalOpen: open }),
}));
