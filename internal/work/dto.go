package work

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// CreateProjectRequest payload for creating a new project.
type CreateProjectRequest struct {
	Key         string  `json:"key"`
	Name        string  `json:"name"`
	LeadID      string  `json:"lead_id"`
	ProjectType string  `json:"project_type"` // 'scrum', 'kanban', 'service'
	WorkflowID  *string `json:"workflow_id,omitempty"`
}

func (r *CreateProjectRequest) Validate() string {
	r.Key = strings.ToUpper(strings.TrimSpace(r.Key))
	if r.Key == "" || len(r.Key) < 2 || len(r.Key) > 10 {
		return "Project key must be between 2 and 10 uppercase characters"
	}
	if strings.TrimSpace(r.Name) == "" {
		return "Project name is required"
	}
	if strings.TrimSpace(r.LeadID) == "" {
		return "Project lead employee ID is required"
	}
	if _, err := uuid.Parse(r.LeadID); err != nil {
		return "Invalid project lead employee ID"
	}
	if r.ProjectType == "" {
		r.ProjectType = "scrum"
	}
	if r.ProjectType != "scrum" && r.ProjectType != "kanban" && r.ProjectType != "service" {
		return "project_type must be scrum, kanban, or service"
	}
	return ""
}

// CreateSprintRequest payload for creating an iteration.
type CreateSprintRequest struct {
	ProjectID string  `json:"project_id"`
	Name      string  `json:"name"`
	Goal      *string `json:"goal,omitempty"`
	StartDate *string `json:"start_date,omitempty"` // RFC3339
	EndDate   *string `json:"end_date,omitempty"`   // RFC3339
}

func (r *CreateSprintRequest) Validate() string {
	if _, err := uuid.Parse(r.ProjectID); err != nil {
		return "Valid project_id is required"
	}
	if strings.TrimSpace(r.Name) == "" {
		return "Sprint name is required"
	}
	return ""
}

// UpdateSprintStatusRequest payload to start or complete a sprint.
type UpdateSprintStatusRequest struct {
	Status string `json:"status"` // 'future', 'active', 'closed'
}

func (r *UpdateSprintStatusRequest) Validate() string {
	if r.Status != "future" && r.Status != "active" && r.Status != "closed" {
		return "status must be future, active, or closed"
	}
	return ""
}

// CreateIssueRequest payload for new agile issue.
type CreateIssueRequest struct {
	ProjectID               string  `json:"project_id"`
	Title                   string  `json:"title"`
	Description             *string `json:"description,omitempty"`
	IssueType               string  `json:"issue_type"` // 'epic', 'story', 'task', 'bug', 'subtask'
	Priority                string  `json:"priority"`   // 'lowest', 'low', 'medium', 'high', 'highest'
	ParentID                *string `json:"parent_id,omitempty"`
	SprintID                *string `json:"sprint_id,omitempty"`
	AssigneeID              *string `json:"assignee_id,omitempty"`
	StoryPoints             *int    `json:"story_points,omitempty"`
	OriginalEstimateSeconds int     `json:"original_estimate_seconds,omitempty"`
	CustomFields            string  `json:"custom_fields,omitempty"` // JSON string
}

func (r *CreateIssueRequest) Validate() string {
	if _, err := uuid.Parse(r.ProjectID); err != nil {
		return "Valid project_id is required"
	}
	if strings.TrimSpace(r.Title) == "" {
		return "Issue title is required"
	}
	if r.IssueType == "" {
		r.IssueType = "task"
	}
	validTypes := map[string]bool{"epic": true, "story": true, "task": true, "bug": true, "subtask": true}
	if !validTypes[r.IssueType] {
		return "issue_type must be epic, story, task, bug, or subtask"
	}
	if r.Priority == "" {
		r.Priority = "medium"
	}
	validPriorities := map[string]bool{"lowest": true, "low": true, "medium": true, "high": true, "highest": true}
	if !validPriorities[r.Priority] {
		return "priority must be lowest, low, medium, high, or highest"
	}
	return ""
}

// UpdateIssueRequest payload for editing an issue.
type UpdateIssueRequest struct {
	Title                    *string `json:"title,omitempty"`
	Description              *string `json:"description,omitempty"`
	Priority                 *string `json:"priority,omitempty"`
	AssigneeID               *string `json:"assignee_id,omitempty"`
	SprintID                 *string `json:"sprint_id,omitempty"`
	StoryPoints              *int    `json:"story_points,omitempty"`
	RemainingEstimateSeconds *int    `json:"remaining_estimate_seconds,omitempty"`
}

// TransitionIssueRequest payload for moving an issue across workflow states.
type TransitionIssueRequest struct {
	TargetStatusID string `json:"target_status_id"`
}

func (r *TransitionIssueRequest) Validate() string {
	if _, err := uuid.Parse(r.TargetStatusID); err != nil {
		return "Valid target_status_id is required"
	}
	return ""
}

// CreateWorklogRequest payload for recording time spent.
type CreateWorklogRequest struct {
	TimeSpentSeconds int       `json:"time_spent_seconds"`
	StartedAt        time.Time `json:"started_at"`
	Description      *string   `json:"description,omitempty"`
	IsBillable       bool      `json:"is_billable"`
}

func (r *CreateWorklogRequest) Validate() string {
	if r.TimeSpentSeconds <= 0 {
		return "time_spent_seconds must be greater than 0"
	}
	if r.StartedAt.IsZero() {
		r.StartedAt = time.Now().UTC()
	}
	return ""
}

// Board and Backlog view representations

type KanbanColumn struct {
	StatusID uuid.UUID `json:"status_id"`
	Name     string    `json:"name"`
	Category string    `json:"category"`
	Position int       `json:"position"`
	Issues   []Issue   `json:"issues"`
}

type KanbanBoardResponse struct {
	Project *Project       `json:"project"`
	Columns []KanbanColumn `json:"columns"`
}

type SprintBucket struct {
	Sprint           Sprint  `json:"sprint"`
	Issues           []Issue `json:"issues"`
	TotalStoryPoints int     `json:"total_story_points"`
}

type BacklogResponse struct {
	Project          *Project       `json:"project"`
	ActiveSprint     *SprintBucket  `json:"active_sprint,omitempty"`
	FutureSprints    []SprintBucket `json:"future_sprints"`
	BacklogIssues    []Issue        `json:"backlog_issues"`
	TotalBacklogPoints int          `json:"total_backlog_points"`
}
