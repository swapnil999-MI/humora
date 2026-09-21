package fusion

import (
	"time"

	"github.com/google/uuid"
)

// MyWorkdayIssue represents an assigned sprint issue for daily focus.
type MyWorkdayIssue struct {
	ID                       uuid.UUID `db:"id" json:"id"`
	ProjectID                uuid.UUID `db:"project_id" json:"project_id"`
	ProjectKey               string    `db:"project_key" json:"project_key"`
	IssueKey                 string    `db:"issue_key" json:"issue_key"`
	Title                    string    `db:"title" json:"title"`
	IssueType                string    `db:"issue_type" json:"issue_type"`
	StatusID                 uuid.UUID `db:"status_id" json:"status_id"`
	StatusName               string    `db:"status_name" json:"status_name"`
	StatusCategory           string    `db:"status_category" json:"status_category"`
	Priority                 string    `db:"priority" json:"priority"`
	StoryPoints              *int      `db:"story_points" json:"story_points,omitempty"`
	OriginalEstimateSeconds  int       `db:"original_estimate_seconds" json:"original_estimate_seconds"`
	RemainingEstimateSeconds int       `db:"remaining_estimate_seconds" json:"remaining_estimate_seconds"`
}

// MyWorkdayWorklog represents a worklog entry recorded today.
type MyWorkdayWorklog struct {
	ID               uuid.UUID `db:"id" json:"id"`
	IssueID          uuid.UUID `db:"issue_id" json:"issue_id"`
	IssueKey         string    `db:"issue_key" json:"issue_key"`
	IssueTitle       string    `db:"issue_title" json:"issue_title"`
	TimeSpentSeconds int       `db:"time_spent_seconds" json:"time_spent_seconds"`
	StartedAt        time.Time `db:"started_at" json:"started_at"`
	Description      *string   `db:"description" json:"description,omitempty"`
	IsBillable       bool      `db:"is_billable" json:"is_billable"`
}

// DailyReconciliation compares clocked office hours with ticket logged hours.
type DailyReconciliation struct {
	ClockedHours    float64 `json:"clocked_hours"`
	LoggedHours     float64 `json:"logged_hours"`
	VarianceHours   float64 `json:"variance_hours"`
	SyncPercentage  float64 `json:"sync_percentage"`
	StatusIndicator string  `json:"status_indicator"` // 'healthy', 'under_logged', 'over_logged'
}

// LeaveBalanceSummary provides a quick glance at leave quotas.
type LeaveBalanceSummary struct {
	LeaveTypeID   uuid.UUID `json:"leave_type_id"`
	LeaveTypeName string    `json:"leave_type_name"`
	LeaveTypeCode string    `json:"leave_type_code"`
	Balance       float64   `json:"balance"`
	Used          float64   `json:"used"`
	Credited      float64   `json:"credited"`
}

// MyWorkdayResponse payload for the employee daily cockpit.
type MyWorkdayResponse struct {
	EmployeeID     uuid.UUID             `json:"employee_id"`
	EmployeeName   string                `json:"employee_name"`
	WorkEmail      string                `json:"work_email"`
	Department     string                `json:"department"`
	Designation    string                `json:"designation"`
	PunchedIn      bool                  `json:"punched_in"`
	LastPunchTime  *time.Time            `json:"last_punch_time,omitempty"`
	TodayHours     float64               `json:"today_hours"`
	Reconciliation DailyReconciliation   `json:"reconciliation"`
	FocusTasks     []MyWorkdayIssue      `json:"focus_tasks"`
	TodayWorklogs  []MyWorkdayWorklog    `json:"today_worklogs"`
	LeaveBalances  []LeaveBalanceSummary `json:"leave_balances"`
}

// TeamMemberCapacity provides manager visibility into an engineer's presence & workload.
type TeamMemberCapacity struct {
	EmployeeID         uuid.UUID  `db:"employee_id" json:"employee_id"`
	EmployeeName       string     `db:"employee_name" json:"employee_name"`
	EmployeeCode       string     `db:"employee_code" json:"employee_code"`
	DesignationTitle   string     `db:"designation_title" json:"designation_title"`
	DepartmentName     string     `db:"department_name" json:"department_name"`
	PunchedIn          bool       `json:"punched_in"`
	PresenceStatus     string     `json:"presence_status"` // 'in_office', 'remote', 'on_leave', 'offline'
	AssignedIssueCount int        `json:"assigned_issue_count"`
	TotalStoryPoints   int        `json:"total_story_points"`
	CapacityStatus     string     `json:"capacity_status"` // 'overloaded' (>15pts), 'balanced' (8-15), 'available' (<8)
	CurrentFocusIssue  *string    `json:"current_focus_issue,omitempty"`
	UpcomingLeaveDates *string    `json:"upcoming_leave_dates,omitempty"`
}

// TeamCapacityResponse payload for manager copilot.
type TeamCapacityResponse struct {
	TotalEngineers      int                   `json:"total_engineers"`
	ClockedInCount      int                   `json:"clocked_in_count"`
	OnLeaveCount        int                   `json:"on_leave_count"`
	OverallocatedCount  int                   `json:"overallocated_count"`
	AvailableCount      int                   `json:"available_count"`
	Members             []TeamMemberCapacity  `json:"members"`
}

// --- 1. Leave-Aware Dynamic Sprint Capacity ---

type EngineerCapacityItem struct {
	EmployeeID         uuid.UUID  `json:"employee_id"`
	EmployeeName       string     `json:"employee_name"`
	EmployeeCode       string     `json:"employee_code"`
	AvatarURL          *string    `json:"avatar_url,omitempty"`
	DesignationTitle   string     `json:"designation_title"`
	WorkingDays        int        `json:"working_days"`
	ApprovedLeaveDays  float64    `json:"approved_leave_days"`
	GrossCapacityHours float64    `json:"gross_capacity_hours"`
	NetCapacityHours   float64    `json:"net_capacity_hours"`
	CommittedHours     float64    `json:"committed_hours"`
	CommittedPoints    int        `json:"committed_points"`
	HasConflict        bool       `json:"has_conflict"`
	ConflictReason     string     `json:"conflict_reason,omitempty"`
}

type SprintCapacityAnalysis struct {
	SprintID               uuid.UUID              `json:"sprint_id"`
	SprintName             string                 `json:"sprint_name"`
	ProjectID              uuid.UUID              `json:"project_id"`
	ProjectKey             string                 `json:"project_key"`
	StartDate              *time.Time             `json:"start_date,omitempty"`
	EndDate                *time.Time             `json:"end_date,omitempty"`
	WorkingDays            int                    `json:"working_days"`
	TotalEngineers         int                    `json:"total_engineers"`
	GrossCapacityHours     float64                `json:"gross_capacity_hours"`
	LeaveHoursDeducted     float64                `json:"leave_hours_deducted"`
	NetCapacityHours       float64                `json:"net_capacity_hours"`
	CommittedHours         float64                `json:"committed_hours"`
	CommittedPoints        int                    `json:"committed_points"`
	CapacityUtilizationPct float64                `json:"capacity_utilization_pct"`
	Overcommitted          bool                   `json:"overcommitted"`
	AlertMessage           string                 `json:"alert_message,omitempty"`
	Engineers              []EngineerCapacityItem `json:"engineers"`
}

// --- 2. Worklog-to-Timesheet Reconciliation ---

type TimesheetIssueWorklog struct {
	IssueID          uuid.UUID `json:"issue_id"`
	IssueKey         string    `json:"issue_key"`
	IssueTitle       string    `json:"issue_title"`
	TimeSpentSeconds int       `json:"time_spent_seconds"`
	Hours            float64   `json:"hours"`
	IsBillable       bool      `json:"is_billable"`
}

type DailyTimesheetItem struct {
	Date          string                  `json:"date"`
	DayOfWeek     string                  `json:"day_of_week"`
	ClockedHours  float64                 `json:"clocked_hours"`
	LoggedHours   float64                 `json:"logged_hours"`
	VarianceHours float64                 `json:"variance_hours"`
	Status        string                  `json:"status"` // 'synced', 'under_logged', 'over_logged', 'weekend', 'leave'
	Worklogs      []TimesheetIssueWorklog `json:"worklogs"`
}

type WeeklyTimesheetReconciliation struct {
	SubmissionID      *uuid.UUID           `json:"submission_id,omitempty"`
	EmployeeID        uuid.UUID            `json:"employee_id"`
	EmployeeName      string               `json:"employee_name"`
	WeekStartDate     string               `json:"week_start_date"`
	WeekEndDate       string               `json:"week_end_date"`
	TotalClockedHours float64              `json:"total_clocked_hours"`
	TotalLoggedHours  float64              `json:"total_logged_hours"`
	VarianceHours     float64              `json:"variance_hours"`
	SyncPercentage    float64              `json:"sync_percentage"`
	SubmissionStatus  string               `json:"submission_status"` // 'draft', 'submitted', 'approved', 'rejected'
	SubmittedAt       *time.Time           `json:"submitted_at,omitempty"`
	ReviewedBy        *string              `json:"reviewed_by,omitempty"`
	ReviewerComments  *string              `json:"reviewer_comments,omitempty"`
	Days              []DailyTimesheetItem `json:"days"`
}

type SubmitTimesheetRequest struct {
	WeekStartDate string `json:"week_start_date"`
	Notes         string `json:"notes"`
}

type ReviewTimesheetRequest struct {
	Status           string `json:"status"` // 'approved' or 'rejected'
	ReviewerComments string `json:"reviewer_comments"`
}

// --- 3. Real-Time Feature & Epic Cost Engine ---

type CostContributorItem struct {
	EmployeeID       uuid.UUID `json:"employee_id"`
	EmployeeName     string    `json:"employee_name"`
	DesignationTitle string    `json:"designation_title"`
	HourlyRate       float64   `json:"hourly_rate"`
	LoggedHours      float64   `json:"logged_hours"`
	IncurredCost     float64   `json:"incurred_cost"`
}

type EpicCostAnalysis struct {
	EpicID          uuid.UUID             `json:"epic_id"`
	EpicKey         string                `json:"epic_key"`
	EpicTitle       string                `json:"epic_title"`
	ProjectKey      string                `json:"project_key"`
	EstimatedHours  float64               `json:"estimated_hours"`
	EstimatedBudget float64               `json:"estimated_budget"`
	ActualHours     float64               `json:"actual_hours"`
	ActualCost      float64               `json:"actual_cost"`
	Variance        float64               `json:"variance"`
	BudgetBurnPct   float64               `json:"budget_burn_pct"`
	Contributors    []CostContributorItem `json:"contributors"`
}

type ProjectCostSummary struct {
	ProjectID          uuid.UUID          `json:"project_id"`
	ProjectKey         string             `json:"project_key"`
	ProjectName        string             `json:"project_name"`
	TotalEpics         int                `json:"total_epics"`
	TotalEstimatedCost float64            `json:"total_estimated_cost"`
	TotalIncurredCost  float64            `json:"total_incurred_cost"`
	Epics              []EpicCostAnalysis `json:"epics"`
}

// --- 4. Developer Well-Being & Burnout Sentinel ---

type MemberBurnoutRisk struct {
	EmployeeID           uuid.UUID `json:"employee_id"`
	EmployeeName         string    `json:"employee_name"`
	EmployeeCode         string    `json:"employee_code"`
	DepartmentName       string    `json:"department_name"`
	DesignationTitle     string    `json:"designation_title"`
	RiskScore            int       `json:"risk_score"` // 0 - 100
	RiskTier             string    `json:"risk_tier"`  // 'optimal', 'moderate', 'high'
	LateCheckoutDays     int       `json:"late_checkout_days"`
	WeekendHoursLogged   float64   `json:"weekend_hours_logged"`
	ActiveSprintPoints   int       `json:"active_sprint_points"`
	DaysSinceLastLeave   int       `json:"days_since_last_leave"`
	PrimaryRiskTrigger   string    `json:"primary_risk_trigger"`
	ActionRecommendation string    `json:"action_recommendation"`
}

type BurnoutSentinelReport struct {
	TenantID              uuid.UUID           `json:"tenant_id"`
	TeamBurnoutIndex      int                 `json:"team_burnout_index"` // 0 - 100
	OverallTier           string              `json:"overall_tier"`       // 'optimal', 'moderate', 'high'
	TotalEngineers        int                 `json:"total_engineers"`
	OptimalCount          int                 `json:"optimal_count"`
	ModerateCount         int                 `json:"moderate_count"`
	HighRiskCount         int                 `json:"high_risk_count"`
	Members               []MemberBurnoutRisk `json:"members"`
	SystemRecommendations []string            `json:"system_recommendations"`
}
