import { create } from 'zustand';
import {
  MyWorkdayResponse,
  TeamCapacityResponse,
  SprintCapacityAnalysis,
  WeeklyTimesheetReconciliation,
  SubmitTimesheetRequest,
  ReviewTimesheetRequest,
  ProjectCostSummary,
  BurnoutSentinelReport,
} from '../types';
import { api } from '../api/client';

export interface FusionState {
  myWorkday: MyWorkdayResponse | null;
  teamCapacity: TeamCapacityResponse | null;
  sprintCapacity: SprintCapacityAnalysis | null;
  weeklyTimesheet: WeeklyTimesheetReconciliation | null;
  teamTimesheets: WeeklyTimesheetReconciliation[];
  costAnalysis: ProjectCostSummary[];
  burnoutSentinel: BurnoutSentinelReport | null;

  isLoadingWorkday: boolean;
  isLoadingTeam: boolean;
  isLoadingSprintCapacity: boolean;
  isLoadingTimesheet: boolean;
  isLoadingTeamTimesheets: boolean;
  isLoadingCost: boolean;
  isLoadingSentinel: boolean;
  isLoggingWork: boolean;
  isReassigning: boolean;
  isSubmittingTimesheet: boolean;
  isReviewingTimesheet: boolean;
  error: string | null;

  fetchMyWorkday: () => Promise<MyWorkdayResponse | null>;
  fetchTeamCapacity: () => Promise<TeamCapacityResponse | null>;
  fetchSprintCapacity: (sprintId: string) => Promise<SprintCapacityAnalysis | null>;
  fetchWeeklyTimesheet: (weekStart?: string) => Promise<WeeklyTimesheetReconciliation | null>;
  submitWeeklyTimesheet: (payload: SubmitTimesheetRequest) => Promise<WeeklyTimesheetReconciliation | null>;
  fetchTeamTimesheets: (status?: string) => Promise<WeeklyTimesheetReconciliation[]>;
  reviewWeeklyTimesheet: (submissionId: string, payload: ReviewTimesheetRequest) => Promise<void>;
  fetchCostAnalysis: (projectId?: string) => Promise<ProjectCostSummary[]>;
  fetchBurnoutSentinel: () => Promise<BurnoutSentinelReport | null>;
  quickLogWork: (payload: { issue_id: string; time_spent_seconds: number; description?: string }) => Promise<any>;
  reassignIssue: (payload: { issueId: string; targetAssigneeId: string }) => Promise<any>;
  clearFusionError: () => void;
}

export const useFusionStore = create<FusionState>((set, get) => ({
  myWorkday: null,
  teamCapacity: null,
  sprintCapacity: null,
  weeklyTimesheet: null,
  teamTimesheets: [],
  costAnalysis: [],
  burnoutSentinel: null,

  isLoadingWorkday: false,
  isLoadingTeam: false,
  isLoadingSprintCapacity: false,
  isLoadingTimesheet: false,
  isLoadingTeamTimesheets: false,
  isLoadingCost: false,
  isLoadingSentinel: false,
  isLoggingWork: false,
  isReassigning: false,
  isSubmittingTimesheet: false,
  isReviewingTimesheet: false,
  error: null,

  fetchMyWorkday: async () => {
    set({ isLoadingWorkday: true, error: null });
    try {
      const res = await api.get<MyWorkdayResponse>('/fusion/my-workday');
      set({ isLoadingWorkday: false, myWorkday: res });
      return res;
    } catch (err: any) {
      set({ isLoadingWorkday: false, error: err.message || 'Failed to fetch workday hub' });
      return null;
    }
  },

  fetchTeamCapacity: async () => {
    set({ isLoadingTeam: true, error: null });
    try {
      const res = await api.get<TeamCapacityResponse>('/fusion/team-capacity');
      set({ isLoadingTeam: false, teamCapacity: res });
      return res;
    } catch (err: any) {
      set({ isLoadingTeam: false, error: err.message || 'Failed to fetch team capacity' });
      return null;
    }
  },

  fetchSprintCapacity: async (sprintId: string) => {
    set({ isLoadingSprintCapacity: true, error: null });
    try {
      const res = await api.get<SprintCapacityAnalysis>(`/fusion/sprint-capacity/${sprintId}`);
      set({ isLoadingSprintCapacity: false, sprintCapacity: res });
      return res;
    } catch (err: any) {
      set({ isLoadingSprintCapacity: false, error: err.message || 'Failed to fetch sprint capacity' });
      return null;
    }
  },

  fetchWeeklyTimesheet: async (weekStart?: string) => {
    set({ isLoadingTimesheet: true, error: null });
    try {
      const query = weekStart ? `?week_start=${weekStart}` : '';
      const res = await api.get<WeeklyTimesheetReconciliation>(`/fusion/timesheets/weekly${query}`);
      set({ isLoadingTimesheet: false, weeklyTimesheet: res });
      return res;
    } catch (err: any) {
      set({ isLoadingTimesheet: false, error: err.message || 'Failed to fetch weekly timesheet' });
      return null;
    }
  },

  submitWeeklyTimesheet: async (payload: SubmitTimesheetRequest) => {
    set({ isSubmittingTimesheet: true, error: null });
    try {
      const res = await api.post<WeeklyTimesheetReconciliation>('/fusion/timesheets/submit', payload);
      set({ isSubmittingTimesheet: false, weeklyTimesheet: res });
      get().fetchTeamTimesheets();
      return res;
    } catch (err: any) {
      set({ isSubmittingTimesheet: false, error: err.message || 'Failed to submit timesheet' });
      throw err;
    }
  },

  fetchTeamTimesheets: async (status?: string) => {
    set({ isLoadingTeamTimesheets: true, error: null });
    try {
      const query = status ? `?status=${status}` : '';
      const res = await api.get<WeeklyTimesheetReconciliation[]>(`/fusion/timesheets/team${query}`);
      set({ isLoadingTeamTimesheets: false, teamTimesheets: res || [] });
      return res || [];
    } catch (err: any) {
      set({ isLoadingTeamTimesheets: false, error: err.message || 'Failed to fetch team timesheets' });
      return [];
    }
  },

  reviewWeeklyTimesheet: async (submissionId: string, payload: ReviewTimesheetRequest) => {
    set({ isReviewingTimesheet: true, error: null });
    try {
      await api.put(`/fusion/timesheets/${submissionId}/review`, payload);
      set({ isReviewingTimesheet: false });
      get().fetchTeamTimesheets();
    } catch (err: any) {
      set({ isReviewingTimesheet: false, error: err.message || 'Failed to review timesheet' });
      throw err;
    }
  },

  fetchCostAnalysis: async (projectId?: string) => {
    set({ isLoadingCost: true, error: null });
    try {
      const query = projectId ? `?project_id=${projectId}` : '';
      const res = await api.get<ProjectCostSummary[]>(`/fusion/cost-analysis${query}`);
      set({ isLoadingCost: false, costAnalysis: res || [] });
      return res || [];
    } catch (err: any) {
      set({ isLoadingCost: false, error: err.message || 'Failed to fetch cost analysis' });
      return [];
    }
  },

  fetchBurnoutSentinel: async () => {
    set({ isLoadingSentinel: true, error: null });
    try {
      const res = await api.get<BurnoutSentinelReport>('/fusion/burnout-sentinel');
      set({ isLoadingSentinel: false, burnoutSentinel: res });
      return res;
    } catch (err: any) {
      set({ isLoadingSentinel: false, error: err.message || 'Failed to fetch burnout sentinel' });
      return null;
    }
  },

  quickLogWork: async (payload) => {
    set({ isLoggingWork: true });
    try {
      const res = await api.post('/fusion/quick-log', payload);
      set({ isLoggingWork: false });
      get().fetchMyWorkday();
      return res;
    } catch (err: any) {
      set({ isLoggingWork: false, error: err.message || 'Failed to log work' });
      throw err;
    }
  },

  reassignIssue: async (payload) => {
    set({ isReassigning: true });
    try {
      const res = await api.put(`/fusion/issues/${payload.issueId}/reassign`, {
        target_assignee_id: payload.targetAssigneeId,
      });
      set({ isReassigning: false });
      get().fetchMyWorkday();
      get().fetchTeamCapacity();
      return res;
    } catch (err: any) {
      set({ isReassigning: false, error: err.message || 'Failed to reassign issue' });
      throw err;
    }
  },

  clearFusionError: () => set({ error: null }),
}));

function withUnwrap<T>(promise: Promise<T>): Promise<T> & { unwrap: () => Promise<T> } {
  const p = promise as Promise<T> & { unwrap: () => Promise<T> };
  p.unwrap = () => promise;
  return p;
}

// Compatibility helpers
export const fetchMyWorkday = () => () => withUnwrap(useFusionStore.getState().fetchMyWorkday());
export const fetchTeamCapacity = () => () => withUnwrap(useFusionStore.getState().fetchTeamCapacity());
export const fetchSprintCapacity = (sprintId: string) => () => withUnwrap(useFusionStore.getState().fetchSprintCapacity(sprintId));
export const fetchWeeklyTimesheet = (weekStart?: string) => () => withUnwrap(useFusionStore.getState().fetchWeeklyTimesheet(weekStart));
export const submitWeeklyTimesheet = (payload: SubmitTimesheetRequest) => () => withUnwrap(useFusionStore.getState().submitWeeklyTimesheet(payload));
export const fetchTeamTimesheets = (status?: string) => () => withUnwrap(useFusionStore.getState().fetchTeamTimesheets(status));
export const reviewWeeklyTimesheet = (submissionId: string, payload: ReviewTimesheetRequest) => () => withUnwrap(useFusionStore.getState().reviewWeeklyTimesheet(submissionId, payload));
export const fetchCostAnalysis = (projectId?: string) => () => withUnwrap(useFusionStore.getState().fetchCostAnalysis(projectId));
export const fetchBurnoutSentinel = () => () => withUnwrap(useFusionStore.getState().fetchBurnoutSentinel());
export const quickLogWork = (payload: { issue_id: string; time_spent_seconds: number; description?: string }) => () =>
  withUnwrap(useFusionStore.getState().quickLogWork(payload));
export const reassignIssue = (payload: { issueId: string; targetAssigneeId: string }) => () =>
  withUnwrap(useFusionStore.getState().reassignIssue(payload));
export const clearFusionError = () => () => useFusionStore.getState().clearFusionError();

export default useFusionStore;
