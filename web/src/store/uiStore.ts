import { create } from 'zustand';

export type WorkspaceType = 'employee' | 'management' | 'work' | 'pulse';
export type HrmsTab =
  | 'dashboard'
  | 'directory'
  | 'attendance'
  | 'leaves'
  | 'approvals'
  | 'capacity'
  | 'onboarding'
  | 'profile'
  | 'shifts'
  | 'radar';
export type WorkTab = 'kanban' | 'backlog';
export type ViewMode = 'board' | 'list';

export type PageId =
  // Employee Self-Service Space
  | 'hub'
  | 'attendance'
  | 'leaves'
  | 'profile'
  | 'payroll'
  // Management & Operations Space
  | 'shifts'
  | 'radar'
  | 'approvals'
  | 'capacity'
  | 'directory'
  | 'onboarding'
  | 'company_settings'
  // Agile Work Space
  | 'kanban'
  | 'list'
  | 'backlog'
  // Team Pulse Collaboration Space
  | 'pulse';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'punch' | 'approval' | 'work' | 'system' | 'leave';
  read: boolean;
  actionLink?: PageId;
}

export interface UiState {
  activePage: PageId;
  workspace: WorkspaceType;
  hrmsTab: HrmsTab;
  workTab: WorkTab;
  viewMode: ViewMode;
  isSidebarCollapsed: boolean;
  isCreateIssueOpen: boolean;
  isCreateProjectOpen: boolean;
  isApplyLeaveOpen: boolean;
  isRegularizationOpen: boolean;
  isNotificationDrawerOpen: boolean;
  notifications: AppNotification[];
  toasts: ToastMessage[];

  navigateToPage: (page: PageId) => void;
  setWorkspace: (workspace: WorkspaceType) => void;
  setHrmsTab: (tab: HrmsTab) => void;
  setWorkTab: (tab: WorkTab) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  setCreateIssueOpen: (open: boolean) => void;
  setCreateProjectOpen: (open: boolean) => void;
  setApplyLeaveOpen: (open: boolean) => void;
  setRegularizationOpen: (open: boolean) => void;
  toggleNotificationDrawer: () => void;
  setNotificationDrawerOpen: (open: boolean) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const syncHash = (page: PageId) => {
  if (typeof window !== 'undefined' && window.location.hash !== `#/${page}`) {
    window.location.hash = `#/${page}`;
  }
};

export const useUiStore = create<UiState>((set) => ({
  activePage: 'hub',
  workspace: 'employee',
  hrmsTab: 'dashboard',
  workTab: 'kanban',
  viewMode: 'board',
  isSidebarCollapsed: false,
  isCreateIssueOpen: false,
  isCreateProjectOpen: false,
  isApplyLeaveOpen: false,
  isRegularizationOpen: false,
  isNotificationDrawerOpen: false,
  notifications: [
    {
      id: 'notif-1',
      title: 'Timesheet Auto-Sync Completed',
      message: '8.0h session was automatically logged and reconciled with Project sprint cycle.',
      timestamp: '15m ago',
      type: 'work',
      read: false,
      actionLink: 'kanban',
    },
    {
      id: 'notif-2',
      title: 'Regularization Approved',
      message: 'Your punch regularization request for yesterday was approved by Lead.',
      timestamp: '1h ago',
      type: 'approval',
      read: false,
      actionLink: 'attendance',
    },
    {
      id: 'notif-3',
      title: 'Sprint Scope Updated',
      message: 'New critical security task assigned to your active queue with high priority.',
      timestamp: '3h ago',
      type: 'work',
      read: true,
      actionLink: 'kanban',
    },
    {
      id: 'notif-4',
      title: 'Monthly Leave Accrual',
      message: '+1.75 days earned leave balance added for the current cycle.',
      timestamp: 'Yesterday',
      type: 'leave',
      read: true,
      actionLink: 'leaves',
    },
  ],
  toasts: [],

  navigateToPage: (page) => {
    syncHash(page);
    set((state) => {
      if (state.activePage === page) return state;
      let workspace = state.workspace;
      let hrmsTab = state.hrmsTab;
      let workTab = state.workTab;
      let viewMode = state.viewMode;

      switch (page) {
        // Employee Self-Service
        case 'hub':
          workspace = 'employee';
          break;
        case 'attendance':
          workspace = 'employee';
          hrmsTab = 'attendance';
          break;
        case 'leaves':
          workspace = 'employee';
          hrmsTab = 'dashboard';
          break;
        case 'profile':
          workspace = 'employee';
          hrmsTab = 'profile';
          break;
        case 'payroll':
          workspace = 'employee';
          break;

        // Management & Operations
        case 'shifts':
          workspace = 'management';
          hrmsTab = 'shifts';
          break;
        case 'radar':
          workspace = 'management';
          hrmsTab = 'radar';
          break;
        case 'approvals':
          workspace = 'management';
          hrmsTab = 'approvals';
          break;
        case 'capacity':
          workspace = 'management';
          hrmsTab = 'capacity';
          break;
        case 'directory':
          workspace = 'management';
          hrmsTab = 'directory';
          break;
        case 'onboarding':
          workspace = 'management';
          hrmsTab = 'onboarding';
          break;
        case 'company_settings':
          workspace = 'management';
          break;

        // Agile Work
        case 'kanban':
          workspace = 'work';
          workTab = 'kanban';
          viewMode = 'board';
          break;
        case 'list':
          workspace = 'work';
          workTab = 'kanban';
          viewMode = 'list';
          break;
        case 'backlog':
          workspace = 'work';
          workTab = 'backlog';
          break;

        // Team Pulse
        case 'pulse':
          workspace = 'pulse';
          break;
      }
      return { activePage: page, workspace, hrmsTab, workTab, viewMode };
    });
  },

  setWorkspace: (workspace) => {
    set((state) => {
      let activePage = state.activePage;
      if (workspace === 'employee') {
        activePage = 'hub';
      } else if (workspace === 'management') {
        activePage = 'shifts';
      } else if (workspace === 'work') {
        activePage =
          state.workTab === 'backlog'
            ? 'backlog'
            : state.viewMode === 'list'
            ? 'list'
            : 'kanban';
      } else if (workspace === 'pulse') {
        activePage = 'pulse';
      }
      if (state.workspace === workspace && state.activePage === activePage) return state;
      syncHash(activePage);
      return { workspace, activePage };
    });
  },

  setHrmsTab: (tab) => {
    set((state) => {
      const activePage = tab === 'dashboard' ? 'leaves' : (tab as PageId);
      const workspace: WorkspaceType = (activePage === 'leaves' || activePage === 'attendance') ? 'employee' : 'management';
      if (state.hrmsTab === tab && state.activePage === activePage && state.workspace === workspace) return state;
      syncHash(activePage);
      return { hrmsTab: tab, workspace, activePage };
    });
  },

  setWorkTab: (tab) => {
    set((state) => {
      const activePage = tab === 'backlog' ? 'backlog' : state.viewMode === 'list' ? 'list' : 'kanban';
      if (state.workTab === tab && state.activePage === activePage) return state;
      syncHash(activePage);
      return { workTab: tab, workspace: 'work', activePage };
    });
  },

  setViewMode: (mode) => {
    set((state) => {
      let activePage = state.activePage;
      if (state.workspace === 'work' && state.workTab === 'kanban') {
        activePage = mode === 'list' ? 'list' : 'kanban';
        syncHash(activePage);
      }
      return { viewMode: mode, activePage };
    });
  },

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setCreateIssueOpen: (open) => set({ isCreateIssueOpen: open }),
  setCreateProjectOpen: (open) => set({ isCreateProjectOpen: open }),
  setApplyLeaveOpen: (open) => set({ isApplyLeaveOpen: open }),
  setRegularizationOpen: (open) => set({ isRegularizationOpen: open }),
  toggleNotificationDrawer: () => set((state) => ({ isNotificationDrawerOpen: !state.isNotificationDrawerOpen })),
  setNotificationDrawerOpen: (open) => set({ isNotificationDrawerOpen: open }),
  markNotificationAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllNotificationsAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearNotifications: () => set({ notifications: [] }),

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }));
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

// Compatibility helpers
export const navigateToPage = (page: PageId) => () => useUiStore.getState().navigateToPage(page);
export const setWorkspace = (w: WorkspaceType) => () => useUiStore.getState().setWorkspace(w);
export const setHrmsTab = (t: HrmsTab) => () => useUiStore.getState().setHrmsTab(t);
export const setWorkTab = (t: WorkTab) => () => useUiStore.getState().setWorkTab(t);
export const setViewMode = (m: ViewMode) => () => useUiStore.getState().setViewMode(m);
export const toggleSidebar = () => () => useUiStore.getState().toggleSidebar();
export const setCreateIssueOpen = (o: boolean) => () => useUiStore.getState().setCreateIssueOpen(o);
export const setCreateProjectOpen = (o: boolean) => () => useUiStore.getState().setCreateProjectOpen(o);
export const setApplyLeaveOpen = (o: boolean) => () => useUiStore.getState().setApplyLeaveOpen(o);
export const setRegularizationOpen = (o: boolean) => () => useUiStore.getState().setRegularizationOpen(o);
export const toggleNotificationDrawer = () => () => useUiStore.getState().toggleNotificationDrawer();
export const setNotificationDrawerOpen = (o: boolean) => () => useUiStore.getState().setNotificationDrawerOpen(o);
export const markNotificationAsRead = (id: string) => () => useUiStore.getState().markNotificationAsRead(id);
export const markAllNotificationsAsRead = () => () => useUiStore.getState().markAllNotificationsAsRead();
export const clearNotifications = () => () => useUiStore.getState().clearNotifications();
export const addToast = (t: Omit<ToastMessage, 'id'>) => () => useUiStore.getState().addToast(t);
export const removeToast = (id: string) => () => useUiStore.getState().removeToast(id);

export default useUiStore;
