package work

import (
	"time"

	"github.com/google/uuid"
)

// Workflow represents a state-machine definition for issue progression.
type Workflow struct {
	ID          uuid.UUID        `db:"id" json:"id"`
	TenantID    uuid.UUID        `db:"tenant_id" json:"tenant_id"`
	Name        string           `db:"name" json:"name"`
	Description *string          `db:"description" json:"description,omitempty"`
	CreatedAt   time.Time        `db:"created_at" json:"created_at"`
	Statuses    []WorkflowStatus `json:"statuses,omitempty"`
}

// WorkflowStatus represents an individual lifecycle column/state.
type WorkflowStatus struct {
	ID         uuid.UUID `db:"id" json:"id"`
	WorkflowID uuid.UUID `db:"workflow_id" json:"workflow_id"`
	Name       string    `db:"name" json:"name"`
	Category   string    `db:"category" json:"category"` // 'todo', 'in_progress', 'done'
	Position   int       `db:"position" json:"position"`
}

// WorkflowTransition defines permitted movements between states.
type WorkflowTransition struct {
	ID           uuid.UUID `db:"id" json:"id"`
	WorkflowID   uuid.UUID `db:"workflow_id" json:"workflow_id"`
	FromStatusID *uuid.UUID `db:"from_status_id" json:"from_status_id,omitempty"`
	ToStatusID   uuid.UUID `db:"to_status_id" json:"to_status_id"`
	Name         string    `db:"name" json:"name"`
	GuardRule    *string   `db:"guard_rule" json:"guard_rule,omitempty"`
	Validators   string    `db:"validators" json:"validators"` // JSON string
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// Project represents an agile work container with its own key prefix and workflow.
type Project struct {
	ID              uuid.UUID `db:"id" json:"id"`
	TenantID        uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Key             string    `db:"key" json:"key"` // e.g., 'HUM', 'ENG'
	Name            string    `db:"name" json:"name"`
	LeadID          uuid.UUID `db:"lead_id" json:"lead_id"`
	LeadName        *string   `db:"lead_name" json:"lead_name,omitempty"`
	WorkflowID      uuid.UUID `db:"workflow_id" json:"workflow_id"`
	WorkflowName    *string   `db:"workflow_name" json:"workflow_name,omitempty"`
	ProjectType     string    `db:"project_type" json:"project_type"` // 'scrum', 'kanban', 'service'
	LastIssueNumber int       `db:"last_issue_number" json:"last_issue_number"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

// Sprint represents a time-boxed iterative agile sprint.
type Sprint struct {
	ID                     uuid.UUID  `db:"id" json:"id"`
	ProjectID              uuid.UUID  `db:"project_id" json:"project_id"`
	Name                   string     `db:"name" json:"name"`
	Goal                   *string    `db:"goal" json:"goal,omitempty"`
	Status                 string     `db:"status" json:"status"` // 'future', 'active', 'closed'
	StartDate              *time.Time `db:"start_date" json:"start_date,omitempty"`
	EndDate                *time.Time `db:"end_date" json:"end_date,omitempty"`
	CalculatedCapacityHours float64   `db:"calculated_capacity_hours" json:"calculated_capacity_hours"`
	CreatedAt              time.Time  `db:"created_at" json:"created_at"`
}

// Issue represents an agile work unit (epic, story, task, bug, subtask).
type Issue struct {
	ID                       uuid.UUID  `db:"id" json:"id"`
	TenantID                 uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	ProjectID                uuid.UUID  `db:"project_id" json:"project_id"`
	ProjectKey               *string    `db:"project_key" json:"project_key,omitempty"`
	IssueNumber              int        `db:"issue_number" json:"issue_number"`
	IssueKey                 string     `db:"issue_key" json:"issue_key"` // e.g. 'HUM-101'
	ParentID                 *uuid.UUID `db:"parent_id" json:"parent_id,omitempty"`
	ParentKey                *string    `db:"parent_key" json:"parent_key,omitempty"`
	SprintID                 *uuid.UUID `db:"sprint_id" json:"sprint_id,omitempty"`
	SprintName               *string    `db:"sprint_name" json:"sprint_name,omitempty"`
	Title                    string     `db:"title" json:"title"`
	Description              *string    `db:"description" json:"description,omitempty"`
	IssueType                string     `db:"issue_type" json:"issue_type"` // 'epic', 'story', 'task', 'bug', 'subtask'
	StatusID                 uuid.UUID  `db:"status_id" json:"status_id"`
	StatusName               *string    `db:"status_name" json:"status_name,omitempty"`
	StatusCategory           *string    `db:"status_category" json:"status_category,omitempty"`
	Priority                 string     `db:"priority" json:"priority"` // 'lowest', 'low', 'medium', 'high', 'highest'
	AssigneeID               *uuid.UUID `db:"assignee_id" json:"assignee_id,omitempty"`
	AssigneeName             *string    `db:"assignee_name" json:"assignee_name,omitempty"`
	ReporterID               uuid.UUID  `db:"reporter_id" json:"reporter_id"`
	ReporterName             *string    `db:"reporter_name" json:"reporter_name,omitempty"`
	StoryPoints              *int       `db:"story_points" json:"story_points,omitempty"`
	OriginalEstimateSeconds  int        `db:"original_estimate_seconds" json:"original_estimate_seconds"`
	RemainingEstimateSeconds int        `db:"remaining_estimate_seconds" json:"remaining_estimate_seconds"`
	CustomFields             string     `db:"custom_fields" json:"custom_fields"` // JSON string
	CreatedAt                time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt                time.Time  `db:"updated_at" json:"updated_at"`
}

// Worklog captures time invested against an agile issue and links with HRMS.
type Worklog struct {
	ID               uuid.UUID  `db:"id" json:"id"`
	TenantID         uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	IssueID          uuid.UUID  `db:"issue_id" json:"issue_id"`
	IssueKey         *string    `db:"issue_key" json:"issue_key,omitempty"`
	EmployeeID       uuid.UUID  `db:"employee_id" json:"employee_id"`
	EmployeeName     *string    `db:"employee_name" json:"employee_name,omitempty"`
	TimeSpentSeconds int        `db:"time_spent_seconds" json:"time_spent_seconds"`
	StartedAt        time.Time  `db:"started_at" json:"started_at"`
	Description      *string    `db:"description" json:"description,omitempty"`
	IsBillable       bool       `db:"is_billable" json:"is_billable"`
	TimesheetEntryID *uuid.UUID `db:"timesheet_entry_id" json:"timesheet_entry_id,omitempty"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
}
