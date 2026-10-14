import { create } from 'zustand';
import {
  Employee,
  OrgNode,
  AttendanceSummary,
  AttendanceSession,
  MonthlyAttendanceResponse,
  TeamPresenceRadarMember,
  Shift,
  EmployeeShiftRoster,
  AttendanceRegularization,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeavePreview,
  EmployeeProfileFull,
  OnboardingCandidate,
  CandidateOnboardingView,
  InviteCandidatePayload,
  CompanyProfile,
  CompensationStructure,
  Payslip,
  ITDeclaration,
  ReimbursementClaim,
  Department,
  Designation,
} from '../types';
import { api } from '../api/client';
import { numberToWordsINR } from '../utils/numberToWords';

export interface HrmsState {
  attendanceSummary: AttendanceSummary | null;
  attendanceSession: AttendanceSession | null;
  monthlyAttendance: MonthlyAttendanceResponse | null;
  teamRadar: TeamPresenceRadarMember[];
  shifts: Shift[];
  shiftRosters: EmployeeShiftRoster[];
  myRegularizations: AttendanceRegularization[];
  teamRegularizations: AttendanceRegularization[];
  employees: Employee[];
  orgTree: OrgNode[];
  leaveTypes: LeaveType[];
  leaveBalances: LeaveBalance[];
  myLeaves: LeaveRequest[];
  companyLeaves: LeaveRequest[];
  currentPreview: LeavePreview | null;
  myProfile: EmployeeProfileFull | null;
  onboardingPipeline: OnboardingCandidate[];
  activeCandidateView: CandidateOnboardingView | null;
  companyProfile: CompanyProfile | null;
  compensationStructure: CompensationStructure | null;
  payslips: Payslip[];
  itDeclaration: ITDeclaration | null;
  reimbursementClaims: ReimbursementClaim[];
  departments: Department[];
  designations: Designation[];
  isLoading: boolean;
  isPunching: boolean;
  isLoadingAttendance: boolean;
  isLoadingShifts: boolean;
  isLoadingDepartments: boolean;
  isLoadingDesignations: boolean;
  isLoadingProfile: boolean;
  isLoadingOnboarding: boolean;
  isLoadingPayroll: boolean;
  error: string | null;
  // Every punch is face-verified: punch buttons open FacePunchModal through this request.
  facePunchRequest: FacePunchRequest | null;
  requestFacePunch: (punchType: string) => Promise<any>;
  finishFacePunch: (result: { ok: true; value: any } | { ok: false }) => void;

  fetchAttendanceSummary: () => Promise<AttendanceSummary | null>;
  recordPunch: (payload: { punch_type: string; latitude?: number; longitude?: number; source?: string }) => Promise<any>;
  fetchAttendanceSession: () => Promise<AttendanceSession | null>;
  executePunch: (payload: { punch_type: string; latitude?: number; longitude?: number; source?: string }) => Promise<any>;
  punchWithFace: (payload: { punch_type: string; selfie_image: string; latitude?: number; longitude?: number; source?: string }) => Promise<any>;
  enrollBiometricFace: (employeeId: string, images: string[]) => Promise<any>;
  fetchMonthlyAttendance: (payload: { year: number; month: number }) => Promise<MonthlyAttendanceResponse | null>;
  fetchTeamRadar: () => Promise<TeamPresenceRadarMember[]>;
  fetchShifts: () => Promise<Shift[]>;
  createShift: (payload: Partial<Shift>) => Promise<Shift>;
  updateShift: (payload: { id: string; data: Partial<Shift> }) => Promise<Shift>;
  deleteShift: (id: string) => Promise<string>;
  fetchShiftRosters: () => Promise<EmployeeShiftRoster[]>;
  assignShift: (payload: { employee_id: string; shift_id: string; effective_date: string }) => Promise<any>;
  bulkAssignShift: (payload: { employee_ids: string[]; shift_id: string; effective_date: string }) => Promise<any>;
  fetchMyRegularizations: (status?: string | void) => Promise<AttendanceRegularization[]>;
  fetchTeamRegularizations: (status?: string | void) => Promise<AttendanceRegularization[]>;
  submitRegularization: (payload: {
    request_type: string;
    request_date: string;
    requested_punch_in?: string;
    requested_punch_out?: string;
    reason: string;
  }) => Promise<any>;
  reviewRegularization: (payload: { id: string; status: 'approved' | 'rejected' }) => Promise<any>;
  fetchEmployees: (search?: string) => Promise<Employee[]>;
  fetchOrgTree: () => Promise<OrgNode[]>;
  fetchLeaveTypes: () => Promise<LeaveType[]>;
  fetchLeaveBalances: () => Promise<LeaveBalance[]>;
  fetchMyLeaves: () => Promise<LeaveRequest[]>;
  fetchCompanyLeaves: () => Promise<LeaveRequest[]>;
  updateLeaveStatus: (payload: { requestId: string; status: 'approved' | 'rejected' }) => Promise<LeaveRequest>;
  previewLeave: (payload: { leave_type_id: string; from_date: string; to_date: string; reason: string }) => Promise<LeavePreview>;
  applyLeave: (payload: { leave_type_id: string; from_date: string; to_date: string; reason: string }) => Promise<any>;
  clearLeavePreview: () => void;
  fetchMyProfile: () => Promise<EmployeeProfileFull | null>;
  updateMyProfile: (payload: any) => Promise<any>;
  uploadProfileMedia: (payload: { file: File; mediaType: 'avatar' | 'banner' }) => Promise<any>;
  fetchOnboardingPipeline: () => Promise<OnboardingCandidate[]>;
  inviteCandidate: (payload: any) => Promise<OnboardingCandidate>;
  convertCandidate: (candidateId: string, payload?: any) => Promise<Employee>;
  fetchCandidateOnboarding: (token: string) => Promise<CandidateOnboardingView | null>;
  saveCandidateDossier: (payload: { token: string; dossier: any }) => Promise<any>;
  fetchCompanyProfile: () => Promise<CompanyProfile | null>;
  updateCompanyProfile: (payload: Partial<CompanyProfile>) => Promise<CompanyProfile>;
  fetchCompensationStructure: (employeeId?: string) => Promise<CompensationStructure | null>;
  fetchPayslips: (employeeId?: string) => Promise<Payslip[]>;
  fetchITDeclaration: (employeeId?: string) => Promise<ITDeclaration | null>;
  saveITDeclaration: (payload: Partial<ITDeclaration>) => Promise<ITDeclaration>;
  fetchReimbursements: (employeeId?: string) => Promise<ReimbursementClaim[]>;
  submitReimbursementClaim: (payload: Partial<ReimbursementClaim>) => Promise<ReimbursementClaim>;
  previewPayrollRun: (month: number, year: number) => Promise<any>;
  executePayrollRun: (month: number, year: number) => Promise<any>;
  fetchPayrollRuns: () => Promise<any[]>;
  fetchDepartments: () => Promise<Department[]>;
  createDepartment: (name: string, description?: string) => Promise<Department>;
  fetchDesignations: () => Promise<Designation[]>;
  createDesignation: (title: string, description?: string) => Promise<Designation>;
  resetHrmsStore: () => void;
}

export const PUNCH_CANCELLED = 'Punch cancelled';

export interface FacePunchRequest {
  punchType: string;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

const normalizePunchType = (t: string) => {
  const raw = (t || '').toLowerCase();
  return raw === 'punch_out' ? 'out' : raw === 'punch_in' ? 'in' : raw;
};

// Helper to attach .unwrap() to returned promises for Redux Toolkit dispatch compatibility
function withUnwrap<T>(promise: Promise<T>): Promise<T> & { unwrap: () => Promise<T> } {
  const p = promise as Promise<T> & { unwrap: () => Promise<T> };
  p.unwrap = () => promise;
  return p;
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  id: '',
  name: '',
  legal_name: '',
  brand_tagline: '',
  logo_url: '',
  cin: '',
  gstin: '',
  pan: '',
  tan: '',
  pf_code: '',
  esi_code: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  contact_email: '',
  contact_phone: '',
  website: '',
  signatory_name: '',
  signatory_title: '',
  pay_cycle_start_day: 1,
};

const HUMORA_COMPANY_PROFILE_KEY = 'humora_company_profile';

export const getStoredCompanyProfile = (): CompanyProfile => {
  if (typeof localStorage === 'undefined') return DEFAULT_COMPANY_PROFILE;
  try {
    const raw = localStorage.getItem(HUMORA_COMPANY_PROFILE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse stored company profile from localStorage', e);
  }
  return DEFAULT_COMPANY_PROFILE;
};

export const saveStoredCompanyProfile = (profile: CompanyProfile) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(HUMORA_COMPANY_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to persist company profile to localStorage', e);
  }
};

export const useHrmsStore = create<HrmsState>((set, get) => ({
  attendanceSummary: null,
  attendanceSession: null,
  monthlyAttendance: null,
  teamRadar: [],
  shifts: [],
  shiftRosters: [],
  myRegularizations: [],
  teamRegularizations: [],
  employees: [],
  orgTree: [],
  leaveTypes: [],
  leaveBalances: [],
  myLeaves: [],
  companyLeaves: [],
  currentPreview: null,
  myProfile: null,
  onboardingPipeline: [],
  activeCandidateView: null,
  companyProfile: null,
  compensationStructure: null,
  payslips: [],
  itDeclaration: null,
  reimbursementClaims: [],
  departments: [],
  designations: [],
  isLoading: false,
  isPunching: false,
  isLoadingAttendance: false,
  isLoadingShifts: false,
  isLoadingDepartments: false,
  isLoadingDesignations: false,
  isLoadingProfile: false,
  isLoadingOnboarding: false,
  isLoadingPayroll: false,
  error: null,
  facePunchRequest: null,

  resetHrmsStore: () => {
    set({
      attendanceSummary: null,
      attendanceSession: null,
      monthlyAttendance: null,
      teamRadar: [],
      shifts: [],
      shiftRosters: [],
      departments: [],
      designations: [],
      myRegularizations: [],
      teamRegularizations: [],
      employees: [],
      orgTree: [],
      leaveTypes: [],
      leaveBalances: [],
      myLeaves: [],
      companyLeaves: [],
      currentPreview: null,
      myProfile: null,
      onboardingPipeline: [],
      activeCandidateView: null,
      companyProfile: null,
      compensationStructure: null,
      payslips: [],
      itDeclaration: null,
      reimbursementClaims: [],
      error: null,
    });
  },

  fetchAttendanceSummary: async () => {
    try {
      const data = await api.get<AttendanceSummary>('/hrms/attendance/summary');
      set({ attendanceSummary: data });
      return data;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  // There is no location-only punch: both entry points open the face check.
  recordPunch: (payload) => get().requestFacePunch(payload.punch_type),

  fetchAttendanceSession: async () => {
    set({ isLoadingAttendance: true });
    try {
      const session = await api.get<AttendanceSession>('/hrms/attendance/session');
      set({ attendanceSession: session, isLoadingAttendance: false });
      return session;
    } catch (err: any) {
      set({ isLoadingAttendance: false, error: err.message });
      return null;
    }
  },

  executePunch: (payload) => get().requestFacePunch(payload.punch_type),

  requestFacePunch: (punchType) =>
    new Promise((resolve, reject) => {
      get().facePunchRequest?.reject(PUNCH_CANCELLED);
      set({ facePunchRequest: { punchType: normalizePunchType(punchType), resolve, reject } });
    }),

  finishFacePunch: (result) => {
    const req = get().facePunchRequest;
    set({ facePunchRequest: null });
    if (!req) return;
    if (result.ok) req.resolve(result.value);
    else req.reject(PUNCH_CANCELLED);
  },

  punchWithFace: async (payload: { punch_type: string; selfie_image: string; latitude?: number; longitude?: number; source?: string }) => {
    set({ isPunching: true });
    try {
      const normalizedType = payload.punch_type === 'punch_out' ? 'out' : payload.punch_type === 'punch_in' ? 'in' : payload.punch_type;
      const res = await api.post<any>('/hrms/attendance/punch-with-face', {
        ...payload,
        punch_type: normalizedType,
      });
      set({ isPunching: false });
      get().fetchAttendanceSession();
      get().fetchAttendanceSummary();
      return res;
    } catch (err: any) {
      set({ isPunching: false, error: err.message });
      throw err;
    }
  },

  enrollBiometricFace: async (employeeId: string, images: string[]) => {
    try {
      const res = await api.post<any>(`/hrms/employees/${employeeId}/biometric-face`, { images });
      get().fetchEmployees();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchMonthlyAttendance: async ({ year, month }) => {
    try {
      const res = await api.get<MonthlyAttendanceResponse>(`/hrms/attendance/calendar?year=${year}&month=${month}`);
      set({ monthlyAttendance: res });
      return res;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  fetchTeamRadar: async () => {
    try {
      const radar = await api.get<TeamPresenceRadarMember[]>('/hrms/attendance/radar');
      set({ teamRadar: radar || [] });
      return radar || [];
    } catch (err: any) {
      set({ teamRadar: [], error: err.message });
      return [];
    }
  },

  fetchShifts: async () => {
    set({ isLoadingShifts: true });
    try {
      const data = await api.get<Shift[]>('/hrms/shifts');
      set({ shifts: data || [], isLoadingShifts: false });
      return data || [];
    } catch (err: any) {
      set({ shifts: [], isLoadingShifts: false, error: err.message });
      return [];
    }
  },

  createShift: async (payload) => {
    try {
      const res = await api.post<Shift>('/hrms/shifts', payload);
      get().fetchShifts();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateShift: async ({ id, data }) => {
    try {
      const res = await api.put<Shift>(`/hrms/shifts/${id}`, data);
      get().fetchShifts();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteShift: async (id) => {
    try {
      await api.delete(`/hrms/shifts/${id}`);
      get().fetchShifts();
      return id;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchShiftRosters: async () => {
    try {
      const rosters = await api.get<EmployeeShiftRoster[]>('/hrms/shifts/rosters');
      set({ shiftRosters: rosters || [] });
      return rosters || [];
    } catch (err: any) {
      set({ shiftRosters: [], error: err.message });
      return [];
    }
  },

  assignShift: async (payload) => {
    try {
      const res = await api.post('/hrms/shifts/assign', payload);
      get().fetchShiftRosters();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  bulkAssignShift: async (payload) => {
    try {
      const res = await api.post('/hrms/shifts/assign-bulk', payload);
      get().fetchShiftRosters();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchMyRegularizations: async (status) => {
    try {
      const query = status ? `?status=${status}` : '';
      const data = await api.get<AttendanceRegularization[]>(`/hrms/attendance/regularizations/mine${query}`);
      set({ myRegularizations: data || [] });
      return data || [];
    } catch (err: any) {
      set({ myRegularizations: [], error: err.message });
      return [];
    }
  },

  fetchTeamRegularizations: async (status) => {
    try {
      const query = status ? `?status=${status}` : '';
      const data = await api.get<AttendanceRegularization[]>(`/hrms/attendance/regularizations/team${query}`);
      set({ teamRegularizations: data || [] });
      return data || [];
    } catch (err: any) {
      set({ teamRegularizations: [], error: err.message });
      return [];
    }
  },

  submitRegularization: async (payload) => {
    try {
      const res = await api.post<AttendanceRegularization>('/hrms/attendance/regularizations', payload);
      get().fetchMyRegularizations();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  reviewRegularization: async ({ id, status }) => {
    try {
      const res = await api.put<AttendanceRegularization>(`/hrms/attendance/regularizations/${id}/review`, { status });
      get().fetchTeamRegularizations();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchEmployees: async (search = '') => {
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get<{ items: Employee[] }>(`/hrms/employees${query}`);
      const items = res.items || [];
      set({ employees: items });
      return items;
    } catch (err: any) {
      set({ error: err.message });
      return [];
    }
  },

  fetchOrgTree: async () => {
    try {
      const data = await api.get<OrgNode[]>('/hrms/employees/org-tree');
      set({ orgTree: data || [] });
      return data || [];
    } catch (err: any) {
      set({ orgTree: [], error: err.message });
      return [];
    }
  },

  fetchLeaveTypes: async () => {
    try {
      const types = await api.get<LeaveType[]>('/hrms/leaves/types');
      set({ leaveTypes: types || [] });
      return types || [];
    } catch (err: any) {
      set({ leaveTypes: [], error: err.message });
      return [];
    }
  },

  fetchLeaveBalances: async () => {
    try {
      const balances = await api.get<LeaveBalance[]>('/hrms/leaves/balances');
      set({ leaveBalances: balances || [] });
      return balances || [];
    } catch (err: any) {
      set({ leaveBalances: [], error: err.message });
      return [];
    }
  },

  fetchMyLeaves: async () => {
    try {
      const res = await api.get<{ items: LeaveRequest[] }>('/hrms/leaves/my-requests');
      const items = res.items || [];
      set({ myLeaves: items });
      return items;
    } catch (err: any) {
      set({ error: err.message });
      return [];
    }
  },

  fetchCompanyLeaves: async () => {
    try {
      const res = await api.get<{ items: LeaveRequest[] }>('/hrms/leaves/all');
      const items = res.items || [];
      set({ companyLeaves: items });
      return items;
    } catch (err: any) {
      set({ error: err.message });
      return [];
    }
  },

  updateLeaveStatus: async (payload) => {
    try {
      const res = await api.put<LeaveRequest>(`/hrms/leaves/requests/${payload.requestId}/status`, {
        status: payload.status,
      });
      get().fetchCompanyLeaves();
      get().fetchMyLeaves();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  previewLeave: async (payload) => {
    try {
      const res = await api.post<LeavePreview>('/hrms/leaves/preview', payload);
      set({ currentPreview: res });
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  applyLeave: async (payload) => {
    try {
      const res = await api.post<LeaveRequest>('/hrms/leaves/apply', payload);
      get().fetchLeaveBalances();
      get().fetchMyLeaves();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  clearLeavePreview: () => set({ currentPreview: null }),

  fetchMyProfile: async () => {
    set({ isLoadingProfile: true });
    try {
      const profile = await api.get<EmployeeProfileFull>('/hrms/profile/me');
      set({ myProfile: profile, isLoadingProfile: false });
      return profile;
    } catch (err: any) {
      set({ isLoadingProfile: false, error: err.message });
      return null;
    }
  },

  updateMyProfile: async (payload) => {
    try {
      const res = await api.put('/hrms/profile/me', payload);
      get().fetchMyProfile();
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  uploadProfileMedia: async ({ file, mediaType }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('media_type', mediaType);
      const data = await api.upload<any>('/hrms/profile/upload', formData);
      get().fetchMyProfile();
      return data;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchOnboardingPipeline: async () => {
    set({ isLoadingOnboarding: true });
    try {
      const candidates = await api.get<OnboardingCandidate[]>('/hrms/onboarding/pipeline');
      set({ onboardingPipeline: candidates || [], isLoadingOnboarding: false });
      return candidates || [];
    } catch (err: any) {
      set({ onboardingPipeline: [], isLoadingOnboarding: false, error: err.message });
      return [];
    }
  },

  inviteCandidate: async (payload) => {
    try {
      const candidate = await api.post<OnboardingCandidate>('/hrms/onboarding/invite', payload);
      get().fetchOnboardingPipeline();
      return candidate;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  convertCandidate: async (candidateId, payload) => {
    try {
      const employee = await api.post<Employee>(`/hrms/onboarding/candidates/${candidateId}/convert`, payload || {});
      get().fetchOnboardingPipeline();
      get().fetchEmployees('');
      return employee;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchCandidateOnboarding: async (token) => {
    try {
      const view = await api.get<CandidateOnboardingView>(`/hrms/onboarding/candidate/${token}`);
      set({ activeCandidateView: view });
      return view;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  saveCandidateDossier: async (payload) => {
    try {
      const res = await api.put(`/hrms/onboarding/candidate/${payload.token}`, payload.dossier);
      get().fetchCandidateOnboarding(payload.token);
      return res;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchCompanyProfile: async () => {
    try {
      set({ isLoadingPayroll: true });
      const data = await api.get<CompanyProfile>('/hrms/company/profile');
      if (data) {
        saveStoredCompanyProfile(data);
        set({ companyProfile: data, isLoadingPayroll: false });
        return data;
      }
      set({ companyProfile: null, isLoadingPayroll: false });
      return null;
    } catch (err: any) {
      set({ error: err.message, isLoadingPayroll: false });
      return get().companyProfile;
    }
  },

  updateCompanyProfile: async (payload: Partial<CompanyProfile>) => {
    try {
      set({ isLoadingPayroll: true });
      const current = get().companyProfile || getStoredCompanyProfile();
      const updated: CompanyProfile = { ...current, ...payload };
      
      const serverRes = await api.put<CompanyProfile>('/hrms/company/profile', updated);
      const finalProfile = serverRes || updated;
      saveStoredCompanyProfile(finalProfile);

      // Also propagate company branding snapshot to all payslips
      const updatedPayslips = get().payslips.map(ps => ({
        ...ps,
        company_snapshot: { ...finalProfile }
      }));

      set({
        companyProfile: finalProfile,
        payslips: updatedPayslips,
        isLoadingPayroll: false
      });
      return finalProfile;
    } catch (err: any) {
      set({ error: err.message, isLoadingPayroll: false });
      throw err;
    }
  },

  fetchCompensationStructure: async (_employeeId?: string) => {
    try {
      set({ isLoadingPayroll: true });
      const data = await api.get<CompensationStructure>('/hrms/payroll/compensation/me');
      set({ compensationStructure: data, isLoadingPayroll: false });
      return data;
    } catch (err: any) {
      console.warn('No active compensation structure found:', err);
      set({ compensationStructure: null, isLoadingPayroll: false });
      return null;
    }
  },

  fetchPayslips: async (_employeeId?: string) => {
    try {
      set({ isLoadingPayroll: true });
      const data = await api.get<Payslip[]>('/hrms/payroll/payslips/mine');
      const list = Array.isArray(data) ? data : [];
      set({ payslips: list, isLoadingPayroll: false });
      return list;
    } catch (err: any) {
      console.warn('No payslips found or error fetching:', err);
      set({ payslips: [], isLoadingPayroll: false });
      return [];
    }
  },

  fetchITDeclaration: async (_employeeId?: string) => {
    try {
      set({ isLoadingPayroll: true });
      const data = await api.get<ITDeclaration>('/hrms/payroll/tax/declaration');
      set({ itDeclaration: data, isLoadingPayroll: false });
      return data;
    } catch (err: any) {
      console.warn('No IT declaration found:', err);
      set({ itDeclaration: null, isLoadingPayroll: false });
      return null;
    }
  },

  saveITDeclaration: async (payload: Partial<ITDeclaration>) => {
    try {
      set({ isLoadingPayroll: true });
      const data = await api.post<ITDeclaration>('/hrms/payroll/tax/declaration', payload);
      set({ itDeclaration: data, isLoadingPayroll: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, isLoadingPayroll: false });
      throw err;
    }
  },

  fetchReimbursements: async (_employeeId?: string) => {
    try {
      set({ isLoadingPayroll: true });
      const data = await api.get<ReimbursementClaim[]>('/hrms/payroll/reimbursements');
      const list = Array.isArray(data) ? data : [];
      set({ reimbursementClaims: list, isLoadingPayroll: false });
      return list;
    } catch (err: any) {
      console.warn('No reimbursements found:', err);
      set({ reimbursementClaims: [], isLoadingPayroll: false });
      return [];
    }
  },

  submitReimbursementClaim: async (payload: Partial<ReimbursementClaim>) => {
    try {
      set({ isLoadingPayroll: true });
      const res = await api.post<ReimbursementClaim>('/hrms/payroll/reimbursements', {
        category: payload.category || 'broadband',
        category_name: payload.category_name || 'Business Expense',
        amount: Number(payload.amount) || 0,
        bill_number: payload.bill_number || undefined,
        // The server expects a full timestamp; the form gives a calendar date.
        bill_date: payload.bill_date ? new Date(`${payload.bill_date.slice(0, 10)}T00:00:00Z`).toISOString() : new Date().toISOString(),
        description: payload.description || '',
        merchant_name: payload.merchant_name || '',
        receipt_url: payload.receipt_url || undefined,
      });
      const updated = [res, ...get().reimbursementClaims];
      set({ reimbursementClaims: updated, isLoadingPayroll: false });
      return res;
    } catch (err: any) {
      set({ error: err.message, isLoadingPayroll: false });
      throw err;
    }
  },

  previewPayrollRun: async (month: number, year: number) => {
    return await api.get<any>(`/hrms/payroll/runs/preview?month=${month}&year=${year}`);
  },

  executePayrollRun: async (month: number, year: number) => {
    const res = await api.post<any>('/hrms/payroll/runs/execute', { month, year });
    await get().fetchPayslips();
    return res;
  },

  fetchPayrollRuns: async () => {
    return await api.get<any[]>('/hrms/payroll/runs');
  },

  fetchDepartments: async () => {
    try {
      set({ isLoadingDepartments: true });
      const res = await api.get<Department[]>('/hrms/departments');
      set({ departments: res || [], isLoadingDepartments: false });
      return res || [];
    } catch (err: any) {
      console.warn('Failed to fetch departments:', err);
      set({ departments: [], isLoadingDepartments: false });
      return [];
    }
  },

  createDepartment: async (name: string, description?: string) => {
    const res = await api.post<Department>('/hrms/departments', { name, description });
    set({ departments: [...get().departments, res] });
    return res;
  },

  fetchDesignations: async () => {
    try {
      set({ isLoadingDesignations: true });
      const res = await api.get<Designation[]>('/hrms/designations');
      set({ designations: res || [], isLoadingDesignations: false });
      return res || [];
    } catch (err: any) {
      console.warn('Failed to fetch designations:', err);
      set({ designations: [], isLoadingDesignations: false });
      return [];
    }
  },

  createDesignation: async (title: string, description?: string) => {
    const res = await api.post<Designation>('/hrms/designations', { title, description });
    set({ designations: [...get().designations, res] });
    return res;
  },
}));

// Compatibility helpers: returns a thunk-like function compatible with withUnwrap and dispatch()
export const fetchAttendanceSummary = () => () => withUnwrap(useHrmsStore.getState().fetchAttendanceSummary());
export const recordPunch = (p: any) => () => withUnwrap(useHrmsStore.getState().recordPunch(p));
export const fetchAttendanceSession = () => () => withUnwrap(useHrmsStore.getState().fetchAttendanceSession());
export const executePunch = (p: any) => () => withUnwrap(useHrmsStore.getState().executePunch(p));
export const punchWithFace = (p: any) => () => withUnwrap(useHrmsStore.getState().punchWithFace(p));
export const enrollBiometricFace = (empId: string, images: string[]) => () => withUnwrap(useHrmsStore.getState().enrollBiometricFace(empId, images));
export const fetchMonthlyAttendance = (p: any) => () => withUnwrap(useHrmsStore.getState().fetchMonthlyAttendance(p));
export const fetchTeamRadar = () => () => withUnwrap(useHrmsStore.getState().fetchTeamRadar());
export const fetchShifts = () => () => withUnwrap(useHrmsStore.getState().fetchShifts());
export const createShift = (p: any) => () => withUnwrap(useHrmsStore.getState().createShift(p));
export const updateShift = (p: any) => () => withUnwrap(useHrmsStore.getState().updateShift(p));
export const deleteShift = (id: string) => () => withUnwrap(useHrmsStore.getState().deleteShift(id));
export const fetchShiftRosters = () => () => withUnwrap(useHrmsStore.getState().fetchShiftRosters());
export const assignShift = (p: any) => () => withUnwrap(useHrmsStore.getState().assignShift(p));
export const bulkAssignShift = (p: any) => () => withUnwrap(useHrmsStore.getState().bulkAssignShift(p));
export const fetchMyRegularizations = (s?: any) => () => withUnwrap(useHrmsStore.getState().fetchMyRegularizations(s));
export const fetchTeamRegularizations = (s?: any) => () => withUnwrap(useHrmsStore.getState().fetchTeamRegularizations(s));
export const submitRegularization = (p: any) => () => withUnwrap(useHrmsStore.getState().submitRegularization(p));
export const reviewRegularization = (p: any) => () => withUnwrap(useHrmsStore.getState().reviewRegularization(p));
export const fetchEmployees = (s?: string) => () => withUnwrap(useHrmsStore.getState().fetchEmployees(s));
export const fetchOrgTree = () => () => withUnwrap(useHrmsStore.getState().fetchOrgTree());
export const fetchLeaveTypes = () => () => withUnwrap(useHrmsStore.getState().fetchLeaveTypes());
export const fetchLeaveBalances = () => () => withUnwrap(useHrmsStore.getState().fetchLeaveBalances());
export const fetchMyLeaves = () => () => withUnwrap(useHrmsStore.getState().fetchMyLeaves());
export const fetchCompanyLeaves = () => () => withUnwrap(useHrmsStore.getState().fetchCompanyLeaves());
export const updateLeaveStatus = (p: any) => () => withUnwrap(useHrmsStore.getState().updateLeaveStatus(p));
export const previewLeave = (p: any) => () => withUnwrap(useHrmsStore.getState().previewLeave(p));
export const applyLeave = (p: any) => () => withUnwrap(useHrmsStore.getState().applyLeave(p));
export const clearLeavePreview = () => () => useHrmsStore.getState().clearLeavePreview();
export const fetchMyProfile = () => () => withUnwrap(useHrmsStore.getState().fetchMyProfile());
export const updateMyProfile = (p: any) => () => withUnwrap(useHrmsStore.getState().updateMyProfile(p));
export const uploadProfileMedia = (p: any) => () => withUnwrap(useHrmsStore.getState().uploadProfileMedia(p));
export const fetchOnboardingPipeline = () => () => withUnwrap(useHrmsStore.getState().fetchOnboardingPipeline());
export const inviteCandidate = (p: any) => () => withUnwrap(useHrmsStore.getState().inviteCandidate(p));
export const convertCandidate = (id: string, payload?: any) => () => withUnwrap(useHrmsStore.getState().convertCandidate(id, payload));
export const fetchCandidateOnboarding = (token: string) => () => withUnwrap(useHrmsStore.getState().fetchCandidateOnboarding(token));
export const saveCandidateDossier = (p: any) => () => withUnwrap(useHrmsStore.getState().saveCandidateDossier(p));

// Payroll compatibility thunks
export const fetchCompanyProfile = () => () => withUnwrap(useHrmsStore.getState().fetchCompanyProfile());
export const updateCompanyProfile = (p: any) => () => withUnwrap(useHrmsStore.getState().updateCompanyProfile(p));
export const fetchCompensationStructure = (empId?: string) => () => withUnwrap(useHrmsStore.getState().fetchCompensationStructure(empId));
export const fetchPayslips = (empId?: string) => () => withUnwrap(useHrmsStore.getState().fetchPayslips(empId));
export const fetchITDeclaration = (empId?: string) => () => withUnwrap(useHrmsStore.getState().fetchITDeclaration(empId));
export const saveITDeclaration = (p: any) => () => withUnwrap(useHrmsStore.getState().saveITDeclaration(p));
export const fetchReimbursements = (empId?: string) => () => withUnwrap(useHrmsStore.getState().fetchReimbursements(empId));
export const submitReimbursementClaim = (p: any) => () => withUnwrap(useHrmsStore.getState().submitReimbursementClaim(p));
export const previewPayrollRun = (month: number, year: number) => () => withUnwrap(useHrmsStore.getState().previewPayrollRun(month, year));
export const executePayrollRun = (month: number, year: number) => () => withUnwrap(useHrmsStore.getState().executePayrollRun(month, year));
export const fetchPayrollRuns = () => () => withUnwrap(useHrmsStore.getState().fetchPayrollRuns());
export const fetchDepartments = () => () => withUnwrap(useHrmsStore.getState().fetchDepartments());
export const createDepartment = (name: string, desc?: string) => () => withUnwrap(useHrmsStore.getState().createDepartment(name, desc));
export const fetchDesignations = () => () => withUnwrap(useHrmsStore.getState().fetchDesignations());
export const createDesignation = (title: string, desc?: string) => () => withUnwrap(useHrmsStore.getState().createDesignation(title, desc));
export const resetHrmsStore = () => () => useHrmsStore.getState().resetHrmsStore();

export default useHrmsStore;
