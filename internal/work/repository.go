package work

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	CreateProject(ctx context.Context, p *Project) error
	GetProjectByID(ctx context.Context, tenantID, id uuid.UUID) (*Project, error)
	GetProjectByKey(ctx context.Context, tenantID uuid.UUID, key string) (*Project, error)
	ListProjects(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]Project, int64, error)
	IncrementIssueNumber(ctx context.Context, tenantID, projectID uuid.UUID) (int, error)

	GetWorkflow(ctx context.Context, tenantID, id uuid.UUID) (*Workflow, error)
	GetDefaultWorkflow(ctx context.Context, tenantID uuid.UUID) (*Workflow, error)
	ListWorkflowStatuses(ctx context.Context, workflowID uuid.UUID) ([]WorkflowStatus, error)
	GetWorkflowStatus(ctx context.Context, statusID uuid.UUID) (*WorkflowStatus, error)

	CreateSprint(ctx context.Context, s *Sprint) error
	GetSprintByID(ctx context.Context, id uuid.UUID) (*Sprint, error)
	ListSprintsByProject(ctx context.Context, projectID uuid.UUID) ([]Sprint, error)
	GetActiveSprint(ctx context.Context, projectID uuid.UUID) (*Sprint, error)
	UpdateSprintStatus(ctx context.Context, id uuid.UUID, status string) error
	UpdateSprintCapacity(ctx context.Context, id uuid.UUID, hours float64) error

	CreateIssue(ctx context.Context, issue *Issue) error
	GetIssueByID(ctx context.Context, tenantID, id uuid.UUID) (*Issue, error)
	GetIssueByKey(ctx context.Context, tenantID uuid.UUID, issueKey string) (*Issue, error)
	ListIssuesByProject(ctx context.Context, tenantID, projectID uuid.UUID, limit, offset int) ([]Issue, int64, error)
	ListIssuesBySprint(ctx context.Context, projectID, sprintID uuid.UUID) ([]Issue, error)
	ListBacklogIssues(ctx context.Context, projectID uuid.UUID) ([]Issue, error)
	UpdateIssue(ctx context.Context, issue *Issue) error
	UpdateIssueStatus(ctx context.Context, tenantID, issueID, statusID uuid.UUID) error
	MoveIssueSprint(ctx context.Context, tenantID, issueID uuid.UUID, sprintID *uuid.UUID) error

	CreateWorklog(ctx context.Context, wl *Worklog) error
	ListWorklogsByIssue(ctx context.Context, tenantID, issueID uuid.UUID) ([]Worklog, error)
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateProject(ctx context.Context, p *Project) error {
	query := `
		INSERT INTO work_projects (
			id, tenant_id, key, name, lead_id, workflow_id, project_type, last_issue_number, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, NOW()
		)
	`
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	_, err := r.db.ExecContext(ctx, query,
		p.ID, p.TenantID, p.Key, p.Name, p.LeadID, p.WorkflowID, p.ProjectType, 0,
	)
	return err
}

func (r *repository) GetProjectByID(ctx context.Context, tenantID, id uuid.UUID) (*Project, error) {
	var p Project
	query := `
		SELECT p.*, CONCAT(e.first_name, ' ', e.last_name) AS lead_name, w.name AS workflow_name
		FROM work_projects p
		LEFT JOIN hrms_employees e ON p.lead_id = e.id
		LEFT JOIN work_workflows w ON p.workflow_id = w.id
		WHERE p.tenant_id = $1 AND p.id = $2
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &p, query, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *repository) GetProjectByKey(ctx context.Context, tenantID uuid.UUID, key string) (*Project, error) {
	var p Project
	query := `
		SELECT p.*, CONCAT(e.first_name, ' ', e.last_name) AS lead_name, w.name AS workflow_name
		FROM work_projects p
		LEFT JOIN hrms_employees e ON p.lead_id = e.id
		LEFT JOIN work_workflows w ON p.workflow_id = w.id
		WHERE p.tenant_id = $1 AND p.key = $2
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &p, query, tenantID, key)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *repository) ListProjects(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]Project, int64, error) {
	var total int64
	countQuery := `SELECT COUNT(*) FROM work_projects WHERE tenant_id = $1`
	if err := r.db.GetContext(ctx, &total, countQuery, tenantID); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT p.*, CONCAT(e.first_name, ' ', e.last_name) AS lead_name, w.name AS workflow_name
		FROM work_projects p
		LEFT JOIN hrms_employees e ON p.lead_id = e.id
		LEFT JOIN work_workflows w ON p.workflow_id = w.id
		WHERE p.tenant_id = $1
		ORDER BY p.created_at DESC
		LIMIT $2 OFFSET $3
	`
	var projects []Project
	err := r.db.SelectContext(ctx, &projects, query, tenantID, limit, offset)
	return projects, total, err
}

func (r *repository) IncrementIssueNumber(ctx context.Context, tenantID, projectID uuid.UUID) (int, error) {
	var nextNum int
	query := `
		UPDATE work_projects
		SET last_issue_number = last_issue_number + 1
		WHERE tenant_id = $1 AND id = $2
		RETURNING last_issue_number
	`
	err := r.db.GetContext(ctx, &nextNum, query, tenantID, projectID)
	return nextNum, err
}

func (r *repository) GetWorkflow(ctx context.Context, tenantID, id uuid.UUID) (*Workflow, error) {
	var wf Workflow
	query := `SELECT * FROM work_workflows WHERE tenant_id = $1 AND id = $2 LIMIT 1`
	err := r.db.GetContext(ctx, &wf, query, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &wf, nil
}

func (r *repository) GetDefaultWorkflow(ctx context.Context, tenantID uuid.UUID) (*Workflow, error) {
	var wf Workflow
	query := `SELECT * FROM work_workflows WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`
	err := r.db.GetContext(ctx, &wf, query, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Check global fallback workflow if tenant has no custom one
			queryGlobal := `SELECT * FROM work_workflows ORDER BY created_at ASC LIMIT 1`
			if errG := r.db.GetContext(ctx, &wf, queryGlobal); errG == nil {
				return &wf, nil
			}
			return nil, nil
		}
		return nil, err
	}
	return &wf, nil
}

func (r *repository) ListWorkflowStatuses(ctx context.Context, workflowID uuid.UUID) ([]WorkflowStatus, error) {
	var statuses []WorkflowStatus
	query := `SELECT * FROM work_workflow_statuses WHERE workflow_id = $1 ORDER BY position ASC`
	err := r.db.SelectContext(ctx, &statuses, query, workflowID)
	return statuses, err
}

func (r *repository) GetWorkflowStatus(ctx context.Context, statusID uuid.UUID) (*WorkflowStatus, error) {
	var s WorkflowStatus
	query := `SELECT * FROM work_workflow_statuses WHERE id = $1 LIMIT 1`
	err := r.db.GetContext(ctx, &s, query, statusID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *repository) CreateSprint(ctx context.Context, s *Sprint) error {
	query := `
		INSERT INTO work_sprints (
			id, project_id, name, goal, status, start_date, end_date, calculated_capacity_hours, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, NOW()
		)
	`
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	_, err := r.db.ExecContext(ctx, query,
		s.ID, s.ProjectID, s.Name, s.Goal, s.Status, s.StartDate, s.EndDate, s.CalculatedCapacityHours,
	)
	return err
}

func (r *repository) GetSprintByID(ctx context.Context, id uuid.UUID) (*Sprint, error) {
	var s Sprint
	query := `SELECT * FROM work_sprints WHERE id = $1 LIMIT 1`
	err := r.db.GetContext(ctx, &s, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *repository) ListSprintsByProject(ctx context.Context, projectID uuid.UUID) ([]Sprint, error) {
	var sprints []Sprint
	query := `SELECT * FROM work_sprints WHERE project_id = $1 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &sprints, query, projectID)
	return sprints, err
}

func (r *repository) GetActiveSprint(ctx context.Context, projectID uuid.UUID) (*Sprint, error) {
	var s Sprint
	query := `SELECT * FROM work_sprints WHERE project_id = $1 AND status = 'active' LIMIT 1`
	err := r.db.GetContext(ctx, &s, query, projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *repository) UpdateSprintStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE work_sprints SET status = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *repository) UpdateSprintCapacity(ctx context.Context, id uuid.UUID, hours float64) error {
	query := `UPDATE work_sprints SET calculated_capacity_hours = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, hours, id)
	return err
}

func (r *repository) CreateIssue(ctx context.Context, issue *Issue) error {
	query := `
		INSERT INTO work_issues (
			id, tenant_id, project_id, issue_number, issue_key, parent_id, sprint_id,
			title, description, issue_type, status_id, priority, assignee_id, reporter_id,
			story_points, original_estimate_seconds, remaining_estimate_seconds, custom_fields,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
		)
	`
	if issue.ID == uuid.Nil {
		issue.ID = uuid.New()
	}
	if issue.CustomFields == "" {
		issue.CustomFields = "{}"
	}
	_, err := r.db.ExecContext(ctx, query,
		issue.ID, issue.TenantID, issue.ProjectID, issue.IssueNumber, issue.IssueKey,
		issue.ParentID, issue.SprintID, issue.Title, issue.Description, issue.IssueType,
		issue.StatusID, issue.Priority, issue.AssigneeID, issue.ReporterID,
		issue.StoryPoints, issue.OriginalEstimateSeconds, issue.RemainingEstimateSeconds,
		issue.CustomFields,
	)
	return err
}

func (r *repository) GetIssueByID(ctx context.Context, tenantID, id uuid.UUID) (*Issue, error) {
	var issue Issue
	query := `
		SELECT i.*, p.key AS project_key,
		       s.name AS sprint_name,
		       st.name AS status_name, st.category AS status_category,
		       CONCAT(a.first_name, ' ', a.last_name) AS assignee_name,
		       CONCAT(rep.first_name, ' ', rep.last_name) AS reporter_name
		FROM work_issues i
		JOIN work_projects p ON i.project_id = p.id
		JOIN work_workflow_statuses st ON i.status_id = st.id
		LEFT JOIN work_sprints s ON i.sprint_id = s.id
		LEFT JOIN hrms_employees a ON i.assignee_id = a.id
		LEFT JOIN hrms_employees rep ON i.reporter_id = rep.id
		WHERE i.tenant_id = $1 AND i.id = $2
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &issue, query, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &issue, nil
}

func (r *repository) GetIssueByKey(ctx context.Context, tenantID uuid.UUID, issueKey string) (*Issue, error) {
	var issue Issue
	query := `
		SELECT i.*, p.key AS project_key,
		       s.name AS sprint_name,
		       st.name AS status_name, st.category AS status_category,
		       CONCAT(a.first_name, ' ', a.last_name) AS assignee_name,
		       CONCAT(rep.first_name, ' ', rep.last_name) AS reporter_name
		FROM work_issues i
		JOIN work_projects p ON i.project_id = p.id
		JOIN work_workflow_statuses st ON i.status_id = st.id
		LEFT JOIN work_sprints s ON i.sprint_id = s.id
		LEFT JOIN hrms_employees a ON i.assignee_id = a.id
		LEFT JOIN hrms_employees rep ON i.reporter_id = rep.id
		WHERE i.tenant_id = $1 AND i.issue_key = $2
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &issue, query, tenantID, issueKey)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &issue, nil
}

func (r *repository) ListIssuesByProject(ctx context.Context, tenantID, projectID uuid.UUID, limit, offset int) ([]Issue, int64, error) {
	var total int64
	countQuery := `SELECT COUNT(*) FROM work_issues WHERE tenant_id = $1 AND project_id = $2`
	if err := r.db.GetContext(ctx, &total, countQuery, tenantID, projectID); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT i.*, p.key AS project_key,
		       s.name AS sprint_name,
		       st.name AS status_name, st.category AS status_category,
		       CONCAT(a.first_name, ' ', a.last_name) AS assignee_name,
		       CONCAT(rep.first_name, ' ', rep.last_name) AS reporter_name
		FROM work_issues i
		JOIN work_projects p ON i.project_id = p.id
		JOIN work_workflow_statuses st ON i.status_id = st.id
		LEFT JOIN work_sprints s ON i.sprint_id = s.id
		LEFT JOIN hrms_employees a ON i.assignee_id = a.id
		LEFT JOIN hrms_employees rep ON i.reporter_id = rep.id
		WHERE i.tenant_id = $1 AND i.project_id = $2
		ORDER BY i.created_at DESC
		LIMIT $3 OFFSET $4
	`
	var issues []Issue
	err := r.db.SelectContext(ctx, &issues, query, tenantID, projectID, limit, offset)
	return issues, total, err
}

func (r *repository) ListIssuesBySprint(ctx context.Context, projectID, sprintID uuid.UUID) ([]Issue, error) {
	query := `
		SELECT i.*, p.key AS project_key,
		       s.name AS sprint_name,
		       st.name AS status_name, st.category AS status_category,
		       CONCAT(a.first_name, ' ', a.last_name) AS assignee_name,
		       CONCAT(rep.first_name, ' ', rep.last_name) AS reporter_name
		FROM work_issues i
		JOIN work_projects p ON i.project_id = p.id
		JOIN work_workflow_statuses st ON i.status_id = st.id
		LEFT JOIN work_sprints s ON i.sprint_id = s.id
		LEFT JOIN hrms_employees a ON i.assignee_id = a.id
		LEFT JOIN hrms_employees rep ON i.reporter_id = rep.id
		WHERE i.project_id = $1 AND i.sprint_id = $2
		ORDER BY i.created_at ASC
	`
	var issues []Issue
	err := r.db.SelectContext(ctx, &issues, query, projectID, sprintID)
	return issues, err
}

func (r *repository) ListBacklogIssues(ctx context.Context, projectID uuid.UUID) ([]Issue, error) {
	query := `
		SELECT i.*, p.key AS project_key,
		       st.name AS status_name, st.category AS status_category,
		       CONCAT(a.first_name, ' ', a.last_name) AS assignee_name,
		       CONCAT(rep.first_name, ' ', rep.last_name) AS reporter_name
		FROM work_issues i
		JOIN work_projects p ON i.project_id = p.id
		JOIN work_workflow_statuses st ON i.status_id = st.id
		LEFT JOIN hrms_employees a ON i.assignee_id = a.id
		LEFT JOIN hrms_employees rep ON i.reporter_id = rep.id
		WHERE i.project_id = $1 AND i.sprint_id IS NULL
		ORDER BY i.created_at ASC
	`
	var issues []Issue
	err := r.db.SelectContext(ctx, &issues, query, projectID)
	return issues, err
}

func (r *repository) UpdateIssue(ctx context.Context, issue *Issue) error {
	query := `
		UPDATE work_issues
		SET title = $1, description = $2, priority = $3, assignee_id = $4,
		    sprint_id = $5, story_points = $6, remaining_estimate_seconds = $7,
		    updated_at = NOW()
		WHERE tenant_id = $8 AND id = $9
	`
	_, err := r.db.ExecContext(ctx, query,
		issue.Title, issue.Description, issue.Priority, issue.AssigneeID,
		issue.SprintID, issue.StoryPoints, issue.RemainingEstimateSeconds,
		issue.TenantID, issue.ID,
	)
	return err
}

func (r *repository) UpdateIssueStatus(ctx context.Context, tenantID, issueID, statusID uuid.UUID) error {
	query := `UPDATE work_issues SET status_id = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, statusID, tenantID, issueID)
	return err
}

func (r *repository) MoveIssueSprint(ctx context.Context, tenantID, issueID uuid.UUID, sprintID *uuid.UUID) error {
	query := `UPDATE work_issues SET sprint_id = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, sprintID, tenantID, issueID)
	return err
}

func (r *repository) CreateWorklog(ctx context.Context, wl *Worklog) error {
	query := `
		INSERT INTO work_worklogs (
			id, tenant_id, issue_id, employee_id, time_spent_seconds, started_at, description, is_billable, timesheet_entry_id, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
		)
	`
	if wl.ID == uuid.Nil {
		wl.ID = uuid.New()
	}
	_, err := r.db.ExecContext(ctx, query,
		wl.ID, wl.TenantID, wl.IssueID, wl.EmployeeID, wl.TimeSpentSeconds, wl.StartedAt, wl.Description, wl.IsBillable, wl.TimesheetEntryID,
	)
	return err
}

func (r *repository) ListWorklogsByIssue(ctx context.Context, tenantID, issueID uuid.UUID) ([]Worklog, error) {
	query := `
		SELECT w.*, i.issue_key, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
		FROM work_worklogs w
		JOIN work_issues i ON w.issue_id = i.id
		JOIN hrms_employees e ON w.employee_id = e.id
		WHERE w.tenant_id = $1 AND w.issue_id = $2
		ORDER BY w.started_at DESC
	`
	var worklogs []Worklog
	err := r.db.SelectContext(ctx, &worklogs, query, tenantID, issueID)
	return worklogs, err
}
