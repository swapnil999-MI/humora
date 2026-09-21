import { create } from 'zustand';
import {
  Project,
  Sprint,
  Issue,
  KanbanBoardResponse,
  BacklogResponse,
  Worklog,
} from '../types';
import { api } from '../api/client';

export interface WorkState {
  projects: Project[];
  activeProject: Project | null;
  kanbanBoard: KanbanBoardResponse | null;
  backlog: BacklogResponse | null;
  activeIssue: Issue | null;
  activeIssueWorklogs: Worklog[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchProjects: () => Promise<Project[]>;
  fetchKanbanBoard: (projectId: string) => Promise<KanbanBoardResponse | null>;
  fetchBacklog: (projectId: string) => Promise<BacklogResponse | null>;
  transitionIssue: (payload: { issueId: string; targetStatusId: string; projectId: string }) => Promise<Issue>;
  updateIssue: (payload: {
    issueId: string;
    projectId: string;
    data: {
      title?: string;
      description?: string;
      priority?: string;
      assignee_id?: string;
      sprint_id?: string;
      story_points?: number;
      remaining_estimate_seconds?: number;
    };
  }) => Promise<Issue>;
  createIssue: (payload: {
    projectId: string;
    title: string;
    description?: string;
    issue_type: string;
    priority: string;
    assignee_id?: string;
    sprint_id?: string;
    story_points?: number;
    original_estimate_seconds?: number;
  }) => Promise<Issue>;
  createSprint: (payload: {
    projectId: string;
    name: string;
    goal?: string;
    start_date?: string;
    end_date?: string;
  }) => Promise<Sprint>;
  updateSprintStatus: (payload: { sprintId: string; status: string; projectId: string }) => Promise<Sprint>;
  logWork: (payload: {
    issueId: string;
    projectId: string;
    timeSpentSeconds: number;
    description?: string;
    isBillable: boolean;
  }) => Promise<Worklog>;
  fetchIssueWorklogs: (issueId: string) => Promise<Worklog[]>;
  setActiveProject: (project: Project) => void;
  setActiveIssue: (issue: Issue | null) => void;
}

export const useWorkStore = create<WorkState>((set, get) => ({
  projects: [],
  activeProject: null,
  kanbanBoard: null,
  backlog: null,
  activeIssue: null,
  activeIssueWorklogs: [],
  isLoading: false,
  isSaving: false,
  error: null,

  fetchProjects: async () => {
    try {
      const res = await api.get<{ items: Project[] }>('/work/projects');
      const items = res.items || [];
      set((state) => ({
        projects: items,
        activeProject: state.activeProject || (items.length > 0 ? items[0] : null),
      }));
      return items;
    } catch (err: any) {
      set({ error: err.message });
      return [];
    }
  },

  fetchKanbanBoard: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<KanbanBoardResponse>(`/work/projects/${projectId}/board`);
      set({ isLoading: false, kanbanBoard: res });
      return res;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return null;
    }
  },

  fetchBacklog: async (projectId: string) => {
    try {
      const res = await api.get<BacklogResponse>(`/work/projects/${projectId}/backlog`);
      set({ backlog: res });
      return res;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  transitionIssue: async (payload) => {
    try {
      const updated = await api.put<Issue>(`/work/issues/${payload.issueId}/transition`, {
        target_status_id: payload.targetStatusId,
      });
      get().fetchKanbanBoard(payload.projectId);
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateIssue: async (payload) => {
    try {
      const updated = await api.patch<Issue>(`/work/issues/${payload.issueId}`, payload.data);
      get().fetchKanbanBoard(payload.projectId);
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  createIssue: async (payload) => {
    try {
      const newIssue = await api.post<Issue>('/work/issues', {
        project_id: payload.projectId,
        title: payload.title,
        description: payload.description,
        issue_type: payload.issue_type,
        priority: payload.priority,
        assignee_id: payload.assignee_id,
        sprint_id: payload.sprint_id,
        story_points: payload.story_points,
        original_estimate_seconds: payload.original_estimate_seconds,
      });
      get().fetchKanbanBoard(payload.projectId);
      get().fetchBacklog(payload.projectId);
      return newIssue;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  createSprint: async (payload) => {
    try {
      const sprint = await api.post<Sprint>(`/work/projects/${payload.projectId}/sprints`, payload);
      get().fetchBacklog(payload.projectId);
      return sprint;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateSprintStatus: async (payload) => {
    try {
      const sprint = await api.put<Sprint>(`/work/sprints/${payload.sprintId}/status`, {
        status: payload.status,
      });
      get().fetchBacklog(payload.projectId);
      get().fetchKanbanBoard(payload.projectId);
      return sprint;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  logWork: async (payload) => {
    try {
      const worklog = await api.post<Worklog>(`/work/issues/${payload.issueId}/worklogs`, {
        time_spent_seconds: payload.timeSpentSeconds,
        description: payload.description,
        is_billable: payload.isBillable,
      });
      get().fetchIssueWorklogs(payload.issueId);
      get().fetchKanbanBoard(payload.projectId);
      return worklog;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchIssueWorklogs: async (issueId: string) => {
    try {
      const logs = await api.get<Worklog[]>(`/work/issues/${issueId}/worklogs`);
      set({ activeIssueWorklogs: logs });
      return logs;
    } catch (err: any) {
      set({ error: err.message });
      return [];
    }
  },

  setActiveProject: (project) => set({ activeProject: project }),
  setActiveIssue: (issue) => set({ activeIssue: issue }),
}));

function withUnwrap<T>(promise: Promise<T>): Promise<T> & { unwrap: () => Promise<T> } {
  const p = promise as Promise<T> & { unwrap: () => Promise<T> };
  p.unwrap = () => promise;
  return p;
}

// Compatibility helpers
export const fetchProjects = () => () => withUnwrap(useWorkStore.getState().fetchProjects());
export const fetchKanbanBoard = (id: string) => () => withUnwrap(useWorkStore.getState().fetchKanbanBoard(id));
export const fetchBacklog = (id: string) => () => withUnwrap(useWorkStore.getState().fetchBacklog(id));
export const transitionIssue = (p: any) => () => withUnwrap(useWorkStore.getState().transitionIssue(p));
export const updateIssue = (p: any) => () => withUnwrap(useWorkStore.getState().updateIssue(p));
export const createIssue = (p: any) => () => withUnwrap(useWorkStore.getState().createIssue(p));
export const createSprint = (p: any) => () => withUnwrap(useWorkStore.getState().createSprint(p));
export const updateSprintStatus = (p: any) => () => withUnwrap(useWorkStore.getState().updateSprintStatus(p));
export const logWork = (p: any) => () => withUnwrap(useWorkStore.getState().logWork(p));
export const fetchIssueWorklogs = (id: string) => () => withUnwrap(useWorkStore.getState().fetchIssueWorklogs(id));
export const setActiveProject = (p: Project) => () => useWorkStore.getState().setActiveProject(p);
export const setActiveIssue = (i: Issue | null) => () => useWorkStore.getState().setActiveIssue(i);

export default useWorkStore;
