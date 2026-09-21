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
  isLoading: boolean;
  isPunching: boolean;
  isLoadingAttendance: boolean;
  isLoadingShifts: boolean;
  isLoadingProfile: boolean;
  isLoadingOnboarding: boolean;
  isLoadingPayroll: boolean;
  error: string | null;

  fetchAttendanceSummary: () => Promise<AttendanceSummary | null>;
  recordPunch: (payload: { punch_type: string; latitude?: number; longitude?: number; source?: string }) => Promise<any>;
  fetchAttendanceSession: () => Promise<AttendanceSession | null>;
  executePunch: (payload: { punch_type: 'in' | 'out' | 'break_start' | 'break_end'; latitude?: number; longitude?: number; source?: string }) => Promise<any>;
  punchWithFace: (payload: { punch_type: 'in' | 'out'; selfie_image: string; latitude?: number; longitude?: number; source?: string }) => Promise<any>;
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
  inviteCandidate: (payload: InviteCandidatePayload) => Promise<OnboardingCandidate>;
  convertCandidate: (candidateId: string) => Promise<Employee>;
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
}

// Helper to attach .unwrap() to returned promises for Redux Toolkit dispatch compatibility
function withUnwrap<T>(promise: Promise<T>): Promise<T> & { unwrap: () => Promise<T> } {
  const p = promise as Promise<T> & { unwrap: () => Promise<T> };
  p.unwrap = () => promise;
  return p;
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  id: 'cmp_humora_corp',
  name: 'Humora Technologies',
  legal_name: 'Humora Technologies Private Limited',
  brand_tagline: 'Enterprise Workforce Engineering & Human Capital Operating System',
  logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
  cin: 'U72200KA2024PTC189201',
  gstin: '29AAACH7409R1ZZ',
  pan: 'AAACH7409R',
  tan: 'BLRH08920E',
  pf_code: 'BGBAN0019283000',
  esi_code: '31000849200000999',
  address_line1: 'Tower 4, Level 9, Cyber Park, Electronic City Phase 1',
  address_line2: 'Hosur Main Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560100',
  country: 'India',
  contact_email: 'payroll@humora.io',
  contact_phone: '+91 80 4912 8800',
  website: 'https://humora.io',
  signatory_name: 'Marcus Vance',
  signatory_title: 'Director of People Operations & HR Compliance',
  pay_cycle_start_day: 1,
};

const HUMORA_COMPANY_PROFILE_KEY = 'humora_company_profile';

export const getStoredCompanyProfile = (): CompanyProfile => {
  if (typeof localStorage === 'undefined') return DEFAULT_COMPANY_PROFILE;
  try {
    const raw = localStorage.getItem(HUMORA_COMPANY_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_COMPANY_PROFILE, ...parsed };
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

export const DEFAULT_COMPENSATION: CompensationStructure = {
  id: 'comp_marcus_01',
  employee_id: 'emp-001',
  annual_ctc: 1800000,
  monthly_gross: 150000,
  basic: 75000, // 50% of monthly gross
  hra: 30000,   // 20% of monthly gross
  conveyance: 3200,
  medical_allowance: 2500,
  special_allowance: 39300,
  provident_fund: 9000, // 12% of basic
  professional_tax: 200,
  employer_pf: 9000,
  gratuity: 3607,
  net_take_home: 128300,
  effective_date: '2026-04-01',
};

export const INITIAL_PAYSLIPS: Payslip[] = [
  {
    id: 'ps_2026_08',
    tenant_id: 'tenant-acme',
    employee_id: 'emp-001',
    employee_name: 'Marcus Vance',
    employee_code: 'EMP-0104',
    designation_title: 'Lead Systems Architect',
    department_name: 'Core Platform Engineering',
    date_of_joining: '2024-03-15',
    bank_name: 'HDFC Bank Ltd',
    bank_account_masked: '•••• •••• 8842',
    bank_ifsc: 'HDFC0001248',
    pan: 'ABCDE1234F',
    uan: '101294829102',
    month: 8,
    year: 2026,
    pay_period: 'August 2026',
    payment_date: '2026-08-31',
    status: 'paid',
    total_days: 31,
    payable_days: 31,
    lop_days: 0,
    basic: 75000,
    hra: 30000,
    conveyance: 3200,
    medical_allowance: 2500,
    special_allowance: 39300,
    bonus: 0,
    gross_earnings: 150000,
    provident_fund: 9000,
    professional_tax: 200,
    tds: 12500,
    lop_deduction: 0,
    other_deductions: 0,
    total_deductions: 21700,
    net_pay: 128300,
    net_pay_in_words: numberToWordsINR(128300),
    company_snapshot: { ...getStoredCompanyProfile() },
  },
  {
    id: 'ps_2026_07',
    tenant_id: 'tenant-acme',
    employee_id: 'emp-001',
    employee_name: 'Marcus Vance',
    employee_code: 'EMP-0104',
    designation_title: 'Lead Systems Architect',
    department_name: 'Core Platform Engineering',
    date_of_joining: '2024-03-15',
    bank_name: 'HDFC Bank Ltd',
    bank_account_masked: '•••• •••• 8842',
    bank_ifsc: 'HDFC0001248',
    pan: 'ABCDE1234F',
    uan: '101294829102',
    month: 7,
    year: 2026,
    pay_period: 'July 2026',
    payment_date: '2026-07-31',
    status: 'paid',
    total_days: 31,
    payable_days: 30,
    lop_days: 1,
    basic: 75000,
    hra: 30000,
    conveyance: 3200,
    medical_allowance: 2500,
    special_allowance: 39300,
    bonus: 0,
    gross_earnings: 150000,
    provident_fund: 9000,
    professional_tax: 200,
    tds: 12500,
    lop_deduction: 4839, // (150000 / 31) * 1 LOP day
    other_deductions: 0,
    total_deductions: 26539,
    net_pay: 123461,
    net_pay_in_words: numberToWordsINR(123461),
    company_snapshot: { ...getStoredCompanyProfile() },
  },
  {
    id: 'ps_2026_06',
    tenant_id: 'tenant-acme',
    employee_id: 'emp-001',
    employee_name: 'Marcus Vance',
    employee_code: 'EMP-0104',
    designation_title: 'Lead Systems Architect',
    department_name: 'Core Platform Engineering',
    date_of_joining: '2024-03-15',
    bank_name: 'HDFC Bank Ltd',
    bank_account_masked: '•••• •••• 8842',
    bank_ifsc: 'HDFC0001248',
    pan: 'ABCDE1234F',
    uan: '101294829102',
    month: 6,
    year: 2026,
    pay_period: 'June 2026',
    payment_date: '2026-06-30',
    status: 'paid',
    total_days: 30,
    payable_days: 30,
    lop_days: 0,
    basic: 75000,
    hra: 30000,
    conveyance: 3200,
    medical_allowance: 2500,
    special_allowance: 39300,
    bonus: 10000,
    gross_earnings: 160000,
    provident_fund: 9000,
    professional_tax: 200,
    tds: 14500,
    lop_deduction: 0,
    other_deductions: 0,
    total_deductions: 23700,
    net_pay: 136300,
    net_pay_in_words: numberToWordsINR(136300),
    company_snapshot: { ...getStoredCompanyProfile() },
  },
];

export const DEFAULT_IT_DECLARATION: ITDeclaration = {
  regime: 'new',
  financial_year: '2026-2027',
  sec_80c_total: 150000,
  sec_80d_health_insurance: 25000,
  sec_80d_parents: 50000,
  hra_annual_rent_paid: 360000,
  hra_landlord_pan: 'AAAPL9821K',
  home_loan_interest: 0,
  nps_contribution: 50000,
  projected_annual_tax: 150000,
  monthly_tds: 12500,
  regime_comparison: {
    old_regime_tax: 162400,
    new_regime_tax: 150000,
    recommended_regime: 'new',
    annual_savings: 12400,
  },
};

export const DEFAULT_REIMBURSEMENTS: ReimbursementClaim[] = [
  {
    id: 'claim-101',
    employee_id: 'emp-001',
    category: 'broadband',
    category_name: 'High-Speed Broadband Internet',
    amount: 2399,
    bill_number: 'ACT-BLR-2026-9921',
    bill_date: '2026-08-28',
    merchant_name: 'ACT Fibernet Gigabit',
    description: 'Monthly Fiber broadband reimbursement for remote development and cloud cluster sync.',
    status: 'reimbursed',
    reviewer_name: 'Priya Sharma (Finance)',
    created_at: '2026-08-29',
  },
  {
    id: 'claim-102',
    employee_id: 'emp-001',
    category: 'learning',
    category_name: 'Professional Skill Development',
    amount: 14999,
    bill_number: 'AMZN-AWS-49210',
    bill_date: '2026-08-15',
    merchant_name: 'Amazon Web Services Training & Certification',
    description: 'AWS Certified Solutions Architect - Professional exam voucher and specialized workshop.',
    status: 'approved',
    reviewer_name: 'Marcus Vance (HOD)',
    created_at: '2026-08-16',
  },
  {
    id: 'claim-103',
    employee_id: 'emp-001',
    category: 'wellness',
    category_name: 'Ergonomic & Wellness Support',
    amount: 4500,
    bill_number: 'FEAT-ERG-8812',
    bill_date: '2026-09-02',
    merchant_name: 'Featherlite Orthopedic Back Support',
    description: 'Ergonomic lumbar chair support and wrist-rest pad for home workstation.',
    status: 'pending',
    reviewer_name: 'Pending Operations Approval',
    created_at: '2026-09-03',
  },
];

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
  companyProfile: getStoredCompanyProfile(),
  compensationStructure: DEFAULT_COMPENSATION,
  payslips: INITIAL_PAYSLIPS,
  itDeclaration: DEFAULT_IT_DECLARATION,
  reimbursementClaims: DEFAULT_REIMBURSEMENTS,
  isLoading: false,
  isPunching: false,
  isLoadingAttendance: false,
  isLoadingShifts: false,
  isLoadingProfile: false,
  isLoadingOnboarding: false,
  isLoadingPayroll: false,
  error: null,

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

  recordPunch: async (payload) => {
    set({ isPunching: true });
    try {
      const res = await api.post('/hrms/attendance/punch', payload);
      set({ isPunching: false });
      get().fetchAttendanceSummary();
      return res;
    } catch (err: any) {
      set({ isPunching: false, error: err.message });
      throw err;
    }
  },

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

  executePunch: async (payload) => {
    set({ isPunching: true });
    try {
      const res = await api.post('/hrms/attendance/punch', payload);
      set({ isPunching: false });
      get().fetchAttendanceSession();
      get().fetchAttendanceSummary();
      return res;
    } catch (err: any) {
      set({ isPunching: false, error: err.message });
      throw err;
    }
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

  convertCandidate: async (candidateId) => {
    try {
      const employee = await api.post<Employee>(`/hrms/onboarding/candidates/${candidateId}/convert`, {});
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
      const current = getStoredCompanyProfile();
      set({ companyProfile: current, isLoadingPayroll: false });
      return current;
    } catch (err: any) {
      set({ error: err.message, isLoadingPayroll: false });
      return get().companyProfile || getStoredCompanyProfile();
    }
  },

  updateCompanyProfile: async (payload: Partial<CompanyProfile>) => {
    try {
      set({ isLoadingPayroll: true });
      const current = get().companyProfile || getStoredCompanyProfile();
      const updated: CompanyProfile = { ...current, ...payload };
      
      saveStoredCompanyProfile(updated);

      // Also propagate company branding snapshot to all payslips
      const updatedPayslips = get().payslips.map(ps => ({
        ...ps,
        company_snapshot: { ...updated }
      }));

      set({
        companyProfile: updated,
        payslips: updatedPayslips,
        isLoadingPayroll: false
      });
      return updated;
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
      console.warn('Falling back to default compensation structure:', err);
      const current = get().compensationStructure || DEFAULT_COMPENSATION;
      set({ compensationStructure: current, isLoadingPayroll: false });
      return current;
    }
  },

  fetchPayslips: async (_employeeId?: string) => {
    try {
      set({ isLoadingPayroll: true });
      const data = await api.get<Payslip[]>('/hrms/payroll/payslips/mine');
      const current = (data && data.length > 0) ? data : (get().payslips.length > 0 ? get().payslips : INITIAL_PAYSLIPS);
      set({ payslips: current, isLoadingPayroll: false });
      return current;
    } catch (err: any) {
      console.warn('Falling back to initial payslips:', err);
      const current = get().payslips.length > 0 ? get().payslips : INITIAL_PAYSLIPS;
      set({ payslips: current, isLoadingPayroll: false });
      return current;
    }
  },

  fetchITDeclaration: async (_employeeId?: string) => {
    try {
      set({ isLoadingPayroll: true });
      const data = await api.get<ITDeclaration>('/hrms/payroll/tax/declaration');
      set({ itDeclaration: data, isLoadingPayroll: false });
      return data;
    } catch (err: any) {
      console.warn('Falling back to default IT declaration:', err);
      const current = get().itDeclaration || DEFAULT_IT_DECLARATION;
      set({ itDeclaration: current, isLoadingPayroll: false });
      return current;
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
      const current = (data && data.length > 0) ? data : (get().reimbursementClaims.length > 0 ? get().reimbursementClaims : DEFAULT_REIMBURSEMENTS);
      set({ reimbursementClaims: current, isLoadingPayroll: false });
      return current;
    } catch (err: any) {
      console.warn('Falling back to default reimbursements:', err);
      const current = get().reimbursementClaims.length > 0 ? get().reimbursementClaims : DEFAULT_REIMBURSEMENTS;
      set({ reimbursementClaims: current, isLoadingPayroll: false });
      return current;
    }
  },

  submitReimbursementClaim: async (payload: Partial<ReimbursementClaim>) => {
    try {
      set({ isLoadingPayroll: true });
      const res = await api.post<ReimbursementClaim>('/hrms/payroll/reimbursements', {
        claim_type: payload.category || 'broadband',
        category_name: payload.category_name || 'Business Expense',
        amount: Number(payload.amount) || 0,
        description: payload.description || '',
        merchant_name: payload.merchant_name || '',
        receipt_url: payload.receipt_url || '',
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
export const convertCandidate = (id: string) => () => withUnwrap(useHrmsStore.getState().convertCandidate(id));
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

export default useHrmsStore;
