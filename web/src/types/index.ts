// TypeScript definitions mirroring Humora Backend Domain Models

export interface User {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  tenant_slug?: string;
  email: string;
  status: string;
  presence_status: string;
  roles: string[];
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface Employee {
  id: string;
  tenant_id: string;
  user_id?: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string;
  personal_email?: string;
  phone?: string;
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_title?: string;
  manager_id?: string;
  manager_name?: string;
  date_of_joining: string;
  employment_type: string;
  status: string;
  hourly_cost_rate: number;
  avatar_url?: string;
  banner_url?: string;
  biometric_face_url?: string;
  biometric_face_registered_at?: string;
  biometric_sample_count?: number;
  effective_from: string;
  effective_to: string;
  created_at: string;
}

export interface OrgNode {
  employee: Employee;
  subordinates: OrgNode[];
}

export interface AttendanceSummary {
  punched_in: boolean;
  last_punch_type?: string;
  last_punch_time?: string;
  today_hours: number;
  total_work_minutes: number;
  active_breaks_count: number;
  expected_work_minutes: number;
}

export interface AttendancePunch {
  id: string;
  tenant_id: string;
  employee_id: string;
  punch_type: 'in' | 'out' | 'break_start' | 'break_end';
  punched_at: string;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  location_id?: string;
  is_geofence_verified: boolean;
  is_offline_signed: boolean;
  is_face_verified?: boolean;
  face_confidence?: number;
  face_distance?: number;
  selfie_url?: string;
  source: string;
  created_at: string;
}

export interface Shift {
  id: string;
  tenant_id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  half_day_hours: number;
  full_day_hours: number;
  is_night_shift: boolean;
  night_shift_allowance: number;
  created_at: string;
}

export interface EmployeeShiftRoster {
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string;
  department_name?: string;
  avatar_url?: string;
  shift_id?: string;
  shift_name?: string;
  start_time?: string;
  end_time?: string;
  grace_minutes?: number;
  effective_date?: string;
}

export interface AttendanceSession {
  employee_id: string;
  current_state: 'out' | 'working' | 'on_break';
  shift?: Shift;
  first_punch_in?: string;
  last_punch_time?: string;
  last_punch_type: string;
  active_work_seconds: number;
  break_seconds: number;
  is_late_in: boolean;
  today_punches: AttendancePunch[] | null;
}

export interface MonthlyAttendanceDay {
  date: string;
  day_of_week: string;
  status: 'present' | 'half_day' | 'absent' | 'leave' | 'holiday' | 'weekend' | 'regularized' | 'pending' | 'scheduled';
  status_label: string;
  first_punch_in?: string;
  last_punch_out?: string;
  work_hours: number;
  break_hours: number;
  expected_hours: number;
  is_late_in: boolean;
  shift_name: string;
  leave_details?: string;
  regularization_id?: string;
  can_regularize: boolean;
  punches?: AttendancePunch[];
}

export interface MonthlyAttendanceResponse {
  year: number;
  month: number;
  days: MonthlyAttendanceDay[];
  total_present: number;
  total_half_days: number;
  total_absent: number;
  total_leaves: number;
  total_holidays: number;
  total_work_hours: number;
  average_work_hours: number;
}

export interface TeamPresenceRadarMember {
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string;
  department_name?: string;
  avatar_url?: string;
  presence_status: 'working' | 'on_break' | 'late_in' | 'on_leave' | 'absent' | 'not_punched';
  first_punch_in?: string;
  last_punch_time?: string;
  active_work_seconds: number;
  shift_name: string;
}

export interface AttendanceRegularization {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  request_type: 'missed_punch' | 'on_duty' | 'wfh';
  request_date: string;
  requested_punch_in?: string;
  requested_punch_out?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approver_name?: string;
  created_at: string;
}


export interface LeaveType {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  annual_quota: number;
  accrual_frequency: string;
  is_carry_forward: boolean;
  max_carry_forward: number;
  is_sandwich_rule_enabled: boolean;
}

export interface LeaveBalance {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  balance: number;
  credited: number;
  used: number;
  year: number;
}

export interface LeavePreview {
  from_date: string;
  to_date: string;
  working_days: number;
  sandwich_days_added: number;
  total_deducted_days: number;
  current_balance: number;
  projected_balance: number;
  sandwich_rule_active: boolean;
}

export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string;
  leave_type_id: string;
  leave_type_name?: string;
  from_date: string;
  to_date: string;
  total_days: number;
  sandwich_days_added: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  current_approval_level: number;
  created_at: string;
}

// Work Management Types
export interface Project {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  lead_id: string;
  lead_name?: string;
  workflow_id: string;
  workflow_name?: string;
  project_type: 'scrum' | 'kanban' | 'service';
  last_issue_number: number;
  created_at: string;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string;
  status: 'future' | 'active' | 'closed';
  start_date?: string;
  end_date?: string;
  calculated_capacity_hours: number;
  created_at: string;
}

export interface Issue {
  id: string;
  tenant_id: string;
  project_id: string;
  project_key?: string;
  issue_number: number;
  issue_key: string;
  parent_id?: string;
  parent_key?: string;
  sprint_id?: string;
  sprint_name?: string;
  title: string;
  description?: string;
  issue_type: 'epic' | 'story' | 'task' | 'bug' | 'subtask';
  status_id: string;
  status_name?: string;
  status_category?: string;
  priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  assignee_id?: string;
  assignee_name?: string;
  reporter_id: string;
  reporter_name?: string;
  story_points?: number;
  original_estimate_seconds: number;
  remaining_estimate_seconds: number;
  custom_fields?: string;
  created_at: string;
  updated_at: string;
}

export interface Worklog {
  id: string;
  tenant_id: string;
  issue_id: string;
  issue_key?: string;
  employee_id: string;
  employee_name?: string;
  time_spent_seconds: number;
  started_at: string;
  description?: string;
  is_billable: boolean;
  timesheet_entry_id?: string;
  created_at: string;
}

export interface KanbanColumn {
  status_id: string;
  name: string;
  category: string;
  position: number;
  issues: Issue[];
}

export interface KanbanBoardResponse {
  project: Project;
  columns: KanbanColumn[];
}

export interface SprintBucket {
  sprint: Sprint;
  issues: Issue[];
  total_story_points: number;
}

export interface BacklogResponse {
  project: Project;
  active_sprint?: SprintBucket;
  future_sprints: SprintBucket[];
  backlog_issues: Issue[];
  total_backlog_points: number;
}

// ----------------------------------------------------------------------
// Fusion Core Models (Cross-Domain HRMS + Agile Work Management)
// ----------------------------------------------------------------------

export interface MyWorkdayIssue {
  id: string;
  project_id: string;
  project_key: string;
  issue_key: string;
  title: string;
  issue_type: string;
  status_id: string;
  status_name: string;
  status_category: string;
  priority: string;
  story_points?: number;
  original_estimate_seconds: number;
  remaining_estimate_seconds: number;
}

export interface MyWorkdayWorklog {
  id: string;
  issue_id: string;
  issue_key: string;
  issue_title: string;
  time_spent_seconds: number;
  started_at: string;
  description?: string;
  is_billable: boolean;
}

export interface DailyReconciliation {
  clocked_hours: number;
  logged_hours: number;
  variance_hours: number;
  sync_percentage: number;
  status_indicator: string;
}

export interface LeaveBalanceSummary {
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  balance: number;
  used: number;
  credited: number;
}

export interface MyWorkdayResponse {
  employee_id: string;
  employee_name: string;
  work_email: string;
  department: string;
  designation: string;
  punched_in: boolean;
  last_punch_time?: string;
  today_hours: number;
  reconciliation: DailyReconciliation;
  focus_tasks: MyWorkdayIssue[] | null;
  today_worklogs: MyWorkdayWorklog[] | null;
  leave_balances: LeaveBalanceSummary[];
}

export interface TeamMemberCapacity {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  designation_title: string;
  department_name: string;
  punched_in: boolean;
  presence_status: string;
  assigned_issue_count: number;
  total_story_points: number;
  capacity_status: string;
  current_focus_issue?: string;
  upcoming_leave_dates?: string;
}

export interface TeamCapacityResponse {
  total_engineers: number;
  clocked_in_count: number;
  on_leave_count: number;
  overallocated_count: number;
  available_count: number;
  members: TeamMemberCapacity[];
}

// ----------------------------------------------------------------------
// Zoho People-Grade Onboarding & Employee Profile Management Models
// ----------------------------------------------------------------------

export interface OnboardingCandidate {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  personal_email: string;
  phone?: string;
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_title?: string;
  manager_id?: string;
  manager_name?: string;
  expected_joining_date: string;
  employment_type: string;
  hourly_cost_rate: number;
  invite_token: string;
  status: 'invited' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  submitted_at?: string;
  approved_at?: string;
  created_at: string;
}

export interface CandidateDossier {
  candidate_id: string;
  personal_details: any;
  emergency_contacts: any[];
  bank_details: any;
  education_history: any[];
  experience_history: any[];
  documents: any[];
  policy_acknowledged: boolean;
  updated_at: string;
}

export interface CandidateOnboardingView {
  candidate: OnboardingCandidate;
  dossier?: CandidateDossier;
}

export interface EmployeePersonalDetails {
  dob?: string;
  gender?: string;
  blood_group?: string;
  marital_status?: string;
  current_address?: string;
  permanent_address?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface EmployeeBankDetails {
  bank_name?: string;
  account_number_masked?: string;
  routing_number?: string;
  tax_id_masked?: string;
  direct_deposit?: boolean;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: number | string;
  grade?: string;
}

export interface ExperienceEntry {
  company: string;
  role: string;
  period: string;
  summary?: string;
}

export interface AssignedAsset {
  asset_name: string;
  category: string;
  serial: string;
  assigned_date: string;
}

export interface EmployeeProfileFull {
  employee: Employee;
  personal_details: EmployeePersonalDetails;
  emergency_contacts: EmergencyContact[];
  bank_details: EmployeeBankDetails;
  education_history: EducationEntry[];
  experience_history: ExperienceEntry[];
  skills: string[];
  assigned_assets: AssignedAsset[];
}

export interface InviteCandidatePayload {
  first_name: string;
  last_name: string;
  personal_email: string;
  phone?: string;
  department_id?: string;
  designation_id?: string;
  manager_id?: string;
  expected_joining_date: string;
  employment_type?: string;
  hourly_cost_rate?: number;
}

// Company Organization & Onboarding Profile
export interface CompanyProfile {
  id?: string;
  name?: string;
  legal_name: string;
  trade_name?: string;
  brand_tagline?: string;
  logo_url: string;
  cin: string;
  gstin: string;
  pan: string;
  tan: string;
  pf_code?: string;
  esi_code?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  signatory_name: string;
  signatory_title: string;
  pay_cycle_start_day: number;
}

// Employee Compensation CTC Structure
export interface CompensationStructure {
  id: string;
  employee_id: string;
  annual_ctc: number;
  monthly_gross: number;
  basic: number;
  hra: number;
  conveyance: number;
  medical_allowance: number;
  special_allowance: number;
  provident_fund: number;
  professional_tax: number;
  employer_pf: number;
  gratuity: number;
  net_take_home: number;
  effective_date: string;
}

// Monthly Official Payslip
export interface Payslip {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  designation_title: string;
  department_name: string;
  date_of_joining: string;
  bank_name: string;
  bank_account_masked: string;
  bank_ifsc: string;
  pan: string;
  uan: string;
  month: number;
  year: number;
  pay_period: string;
  payment_date: string;
  status: 'paid' | 'processing' | 'hold';
  total_days: number;
  payable_days: number;
  lop_days: number;
  // Itemized Earnings
  basic: number;
  hra: number;
  conveyance: number;
  medical_allowance: number;
  special_allowance: number;
  bonus: number;
  gross_earnings: number;
  // Itemized Deductions
  provident_fund: number;
  professional_tax: number;
  tds: number;
  lop_deduction: number;
  other_deductions: number;
  total_deductions: number;
  // Net Total
  net_pay: number;
  net_pay_in_words: string;
  company_snapshot: CompanyProfile;
}

// Income Tax Declaration & Regime Planner
export interface ITDeclaration {
  regime: 'new' | 'old';
  financial_year: string;
  sec_80c_total: number;
  sec_80d_health_insurance: number;
  sec_80d_parents: number;
  hra_annual_rent_paid: number;
  hra_landlord_pan?: string;
  home_loan_interest: number;
  nps_contribution: number;
  projected_annual_tax: number;
  monthly_tds: number;
  regime_comparison?: {
    old_regime_tax: number;
    new_regime_tax: number;
    recommended_regime: 'new' | 'old';
    annual_savings: number;
  };
}

// Reimbursement / Expense Claim (FBP)
export interface ReimbursementClaim {
  id: string;
  employee_id: string;
  category: 'broadband' | 'learning' | 'travel' | 'wellness' | 'office_supplies';
  category_name: string;
  amount: number;
  bill_number?: string;
  bill_date: string;
  merchant_name: string;
  description: string;
  receipt_url?: string;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  reviewer_name?: string;
  created_at: string;
}

// ----------------------------------------------------------------------
// Cross-Domain Synergy Engines (Leave-Aware Capacity, Timesheet Reconciliation, Cost Analysis, Burnout Sentinel)
// ----------------------------------------------------------------------

export interface EngineerCapacityItem {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  avatar_url?: string;
  designation_title: string;
  working_days: number;
  approved_leave_days: number;
  gross_capacity_hours: number;
  net_capacity_hours: number;
  committed_hours: number;
  committed_points: number;
  has_conflict: boolean;
  conflict_reason?: string;
}

export interface SprintCapacityAnalysis {
  sprint_id: string;
  sprint_name: string;
  project_id: string;
  project_key: string;
  start_date?: string;
  end_date?: string;
  working_days: number;
  total_engineers: number;
  gross_capacity_hours: number;
  leave_hours_deducted: number;
  net_capacity_hours: number;
  committed_hours: number;
  committed_points: number;
  capacity_utilization_pct: number;
  overcommitted: boolean;
  alert_message?: string;
  engineers: EngineerCapacityItem[];
}

export interface TimesheetIssueWorklog {
  issue_id: string;
  issue_key: string;
  issue_title: string;
  time_spent_seconds: number;
  hours: number;
  is_billable: boolean;
}

export interface DailyTimesheetItem {
  date: string;
  day_of_week: string;
  clocked_hours: number;
  logged_hours: number;
  variance_hours: number;
  status: 'synced' | 'under_logged' | 'over_logged' | 'weekend';
  worklogs?: TimesheetIssueWorklog[];
}

export interface WeeklyTimesheetReconciliation {
  submission_id?: string;
  employee_id: string;
  employee_name: string;
  week_start_date: string;
  week_end_date: string;
  total_clocked_hours: number;
  total_logged_hours: number;
  variance_hours: number;
  sync_percentage: number;
  submission_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at?: string;
  reviewed_by?: string;
  reviewer_comments?: string;
  days?: DailyTimesheetItem[];
}

export interface SubmitTimesheetRequest {
  week_start_date: string;
  notes?: string;
}

export interface ReviewTimesheetRequest {
  status: 'approved' | 'rejected';
  reviewer_comments?: string;
}

export interface CostContributorItem {
  employee_id: string;
  employee_name: string;
  designation_title: string;
  hourly_rate: number;
  logged_hours: number;
  incurred_cost: number;
}

export interface EpicCostAnalysis {
  epic_id: string;
  epic_key: string;
  epic_title: string;
  estimated_hours: number;
  actual_hours: number;
  budget_cost: number;
  actual_cost: number;
  variance_cost: number;
  budget_burn_pct: number;
  is_over_budget: boolean;
  contributors: CostContributorItem[];
}

export interface ProjectCostSummary {
  project_id: string;
  project_key: string;
  project_name: string;
  total_epics: number;
  total_estimated_cost: number;
  total_incurred_cost: number;
  epics?: EpicCostAnalysis[];
}

export interface MemberBurnoutRisk {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  avatar_url?: string;
  department_name: string;
  designation_title: string;
  risk_score: number;
  risk_tier: 'optimal' | 'moderate' | 'high_risk';
  late_checkout_days: number;
  weekend_hours_logged: number;
  active_sprint_points: number;
  days_since_last_leave: number;
  primary_risk_trigger: string;
  action_recommendation: string;
}

export interface BurnoutSentinelReport {
  tenant_id: string;
  team_burnout_index: number;
  overall_tier: 'optimal' | 'moderate' | 'high_risk';
  total_engineers: number;
  optimal_count: number;
  moderate_count: number;
  high_risk_count: number;
  members: MemberBurnoutRisk[];
  system_recommendations: string[];
}



