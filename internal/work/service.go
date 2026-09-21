package work

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Service interface {
	CreateProject(ctx context.Context, tenantID uuid.UUID, req *CreateProjectRequest) (*Project, error)
	GetProject(ctx context.Context, tenantID, id uuid.UUID) (*Project, error)
	ListProjects(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]Project, int64, error)

	CreateSprint(ctx context.Context, tenantID uuid.UUID, req *CreateSprintRequest) (*Sprint, error)
	ListSprints(ctx context.Context, tenantID, projectID uuid.UUID) ([]Sprint, error)
	UpdateSprintStatus(ctx context.Context, tenantID, sprintID uuid.UUID, status string) (*Sprint, error)

	CreateIssue(ctx context.Context, tenantID, reporterUserID uuid.UUID, reporterEmployeeID uuid.UUID, req *CreateIssueRequest) (*Issue, error)
	GetIssue(ctx context.Context, tenantID, id uuid.UUID) (*Issue, error)
	GetIssueByKey(ctx context.Context, tenantID uuid.UUID, issueKey string) (*Issue, error)
	ListIssues(ctx context.Context, tenantID, projectID uuid.UUID, limit, offset int) ([]Issue, int64, error)
	TransitionIssue(ctx context.Context, tenantID, issueID, targetStatusID uuid.UUID) (*Issue, error)
	UpdateIssue(ctx context.Context, tenantID, issueID uuid.UUID, req *UpdateIssueRequest) (*Issue, error)

	GetKanbanBoard(ctx context.Context, tenantID, projectID uuid.UUID) (*KanbanBoardResponse, error)
	GetBacklog(ctx context.Context, tenantID, projectID uuid.UUID) (*BacklogResponse, error)

	CreateWorklog(ctx context.Context, tenantID, issueID, employeeID uuid.UUID, req *CreateWorklogRequest) (*Worklog, error)
	ListWorklogs(ctx context.Context, tenantID, issueID uuid.UUID) ([]Worklog, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) CreateProject(ctx context.Context, tenantID uuid.UUID, req *CreateProjectRequest) (*Project, error) {
	if valErr := req.Validate(); valErr != "" {
		return nil, errors.New(valErr)
	}

	leadUUID, _ := uuid.Parse(req.LeadID)

	var workflowID uuid.UUID
	if req.WorkflowID != nil && *req.WorkflowID != "" {
		parsed, err := uuid.Parse(*req.WorkflowID)
		if err != nil {
			return nil, errors.New("invalid workflow_id")
		}
		workflowID = parsed
	} else {
		// Use default workflow
		wf, err := s.repo.GetDefaultWorkflow(ctx, tenantID)
		if err != nil || wf == nil {
			return nil, errors.New("no agile workflow available for tenant")
		}
		workflowID = wf.ID
	}

	existing, err := s.repo.GetProjectByKey(ctx, tenantID, req.Key)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("project with key '%s' already exists", req.Key)
	}

	project := &Project{
		ID:          uuid.New(),
		TenantID:    tenantID,
		Key:         req.Key,
		Name:        strings.TrimSpace(req.Name),
		LeadID:      leadUUID,
		WorkflowID:  workflowID,
		ProjectType: req.ProjectType,
	}

	if err := s.repo.CreateProject(ctx, project); err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	return s.repo.GetProjectByID(ctx, tenantID, project.ID)
}

func (s *service) GetProject(ctx context.Context, tenantID, id uuid.UUID) (*Project, error) {
	return s.repo.GetProjectByID(ctx, tenantID, id)
}

func (s *service) ListProjects(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]Project, int64, error) {
	return s.repo.ListProjects(ctx, tenantID, limit, offset)
}

func (s *service) CreateSprint(ctx context.Context, tenantID uuid.UUID, req *CreateSprintRequest) (*Sprint, error) {
	if valErr := req.Validate(); valErr != "" {
		return nil, errors.New(valErr)
	}

	projectUUID, _ := uuid.Parse(req.ProjectID)
	project, err := s.repo.GetProjectByID(ctx, tenantID, projectUUID)
	if err != nil || project == nil {
		return nil, errors.New("project not found")
	}

	var startDate, endDate *time.Time
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse(time.RFC3339, *req.StartDate); err == nil {
			startDate = &t
		}
	}
	if req.EndDate != nil && *req.EndDate != "" {
		if t, err := time.Parse(time.RFC3339, *req.EndDate); err == nil {
			endDate = &t
		}
	}

	sprint := &Sprint{
		ID:        uuid.New(),
		ProjectID: projectUUID,
		Name:      strings.TrimSpace(req.Name),
		Goal:      req.Goal,
		Status:    "future",
		StartDate: startDate,
		EndDate:   endDate,
	}

	if err := s.repo.CreateSprint(ctx, sprint); err != nil {
		return nil, fmt.Errorf("failed to create sprint: %w", err)
	}

	return sprint, nil
}

func (s *service) ListSprints(ctx context.Context, tenantID, projectID uuid.UUID) ([]Sprint, error) {
	return s.repo.ListSprintsByProject(ctx, projectID)
}

func (s *service) UpdateSprintStatus(ctx context.Context, tenantID, sprintID uuid.UUID, status string) (*Sprint, error) {
	sprint, err := s.repo.GetSprintByID(ctx, sprintID)
	if err != nil || sprint == nil {
		return nil, errors.New("sprint not found")
	}

	if status == "active" {
		// Verify no other sprint is active in this project
		active, _ := s.repo.GetActiveSprint(ctx, sprint.ProjectID)
		if active != nil && active.ID != sprintID {
			return nil, fmt.Errorf("another sprint '%s' is already active", active.Name)
		}
	}

	if err := s.repo.UpdateSprintStatus(ctx, sprintID, status); err != nil {
		return nil, fmt.Errorf("failed to update sprint status: %w", err)
	}

	sprint.Status = status
	return sprint, nil
}

func (s *service) CreateIssue(ctx context.Context, tenantID, reporterUserID uuid.UUID, reporterEmployeeID uuid.UUID, req *CreateIssueRequest) (*Issue, error) {
	if valErr := req.Validate(); valErr != "" {
		return nil, errors.New(valErr)
	}

	projectUUID, _ := uuid.Parse(req.ProjectID)
	project, err := s.repo.GetProjectByID(ctx, tenantID, projectUUID)
	if err != nil || project == nil {
		return nil, errors.New("project not found")
	}

	// Atomically increment issue number
	nextNum, err := s.repo.IncrementIssueNumber(ctx, tenantID, projectUUID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate sequential issue key: %w", err)
	}
	issueKey := fmt.Sprintf("%s-%d", project.Key, nextNum)

	// Fetch default initial status for workflow
	statuses, err := s.repo.ListWorkflowStatuses(ctx, project.WorkflowID)
	if err != nil || len(statuses) == 0 {
		return nil, errors.New("no statuses configured for project workflow")
	}
	initialStatusID := statuses[0].ID

	var assigneeUUID *uuid.UUID
	if req.AssigneeID != nil && *req.AssigneeID != "" {
		if parsed, err := uuid.Parse(*req.AssigneeID); err == nil {
			assigneeUUID = &parsed
		}
	}

	var parentUUID *uuid.UUID
	if req.ParentID != nil && *req.ParentID != "" {
		if parsed, err := uuid.Parse(*req.ParentID); err == nil {
			parentUUID = &parsed
		}
	}

	var sprintUUID *uuid.UUID
	if req.SprintID != nil && *req.SprintID != "" {
		if parsed, err := uuid.Parse(*req.SprintID); err == nil {
			sprintUUID = &parsed
		}
	}

	issue := &Issue{
		ID:                       uuid.New(),
		TenantID:                 tenantID,
		ProjectID:                projectUUID,
		IssueNumber:              nextNum,
		IssueKey:                 issueKey,
		ParentID:                 parentUUID,
		SprintID:                 sprintUUID,
		Title:                    strings.TrimSpace(req.Title),
		Description:              req.Description,
		IssueType:                req.IssueType,
		StatusID:                 initialStatusID,
		Priority:                 req.Priority,
		AssigneeID:               assigneeUUID,
		ReporterID:               reporterEmployeeID,
		StoryPoints:              req.StoryPoints,
		OriginalEstimateSeconds:  req.OriginalEstimateSeconds,
		RemainingEstimateSeconds: req.OriginalEstimateSeconds,
		CustomFields:             req.CustomFields,
	}

	if err := s.repo.CreateIssue(ctx, issue); err != nil {
		return nil, fmt.Errorf("failed to create issue: %w", err)
	}

	return s.repo.GetIssueByID(ctx, tenantID, issue.ID)
}

func (s *service) GetIssue(ctx context.Context, tenantID, id uuid.UUID) (*Issue, error) {
	return s.repo.GetIssueByID(ctx, tenantID, id)
}

func (s *service) GetIssueByKey(ctx context.Context, tenantID uuid.UUID, issueKey string) (*Issue, error) {
	return s.repo.GetIssueByKey(ctx, tenantID, issueKey)
}

func (s *service) ListIssues(ctx context.Context, tenantID, projectID uuid.UUID, limit, offset int) ([]Issue, int64, error) {
	return s.repo.ListIssuesByProject(ctx, tenantID, projectID, limit, offset)
}

func (s *service) TransitionIssue(ctx context.Context, tenantID, issueID, targetStatusID uuid.UUID) (*Issue, error) {
	issue, err := s.repo.GetIssueByID(ctx, tenantID, issueID)
	if err != nil || issue == nil {
		return nil, errors.New("issue not found")
	}

	// Verify target status exists
	targetStatus, err := s.repo.GetWorkflowStatus(ctx, targetStatusID)
	if err != nil || targetStatus == nil {
		return nil, errors.New("target workflow status not found")
	}

	if err := s.repo.UpdateIssueStatus(ctx, tenantID, issueID, targetStatusID); err != nil {
		return nil, fmt.Errorf("failed to update issue status: %w", err)
	}

	return s.repo.GetIssueByID(ctx, tenantID, issueID)
}

func (s *service) UpdateIssue(ctx context.Context, tenantID, issueID uuid.UUID, req *UpdateIssueRequest) (*Issue, error) {
	issue, err := s.repo.GetIssueByID(ctx, tenantID, issueID)
	if err != nil || issue == nil {
		return nil, errors.New("issue not found")
	}

	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		issue.Title = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		issue.Description = req.Description
	}
	if req.Priority != nil && *req.Priority != "" {
		issue.Priority = *req.Priority
	}
	if req.AssigneeID != nil {
		if *req.AssigneeID == "" {
			issue.AssigneeID = nil
		} else if parsed, err := uuid.Parse(*req.AssigneeID); err == nil {
			issue.AssigneeID = &parsed
		}
	}
	if req.SprintID != nil {
		if *req.SprintID == "" {
			issue.SprintID = nil
		} else if parsed, err := uuid.Parse(*req.SprintID); err == nil {
			issue.SprintID = &parsed
		}
	}
	if req.StoryPoints != nil {
		issue.StoryPoints = req.StoryPoints
	}
	if req.RemainingEstimateSeconds != nil {
		issue.RemainingEstimateSeconds = *req.RemainingEstimateSeconds
	}

	if err := s.repo.UpdateIssue(ctx, issue); err != nil {
		return nil, fmt.Errorf("failed to update issue: %w", err)
	}

	return s.repo.GetIssueByID(ctx, tenantID, issueID)
}

func (s *service) GetKanbanBoard(ctx context.Context, tenantID, projectID uuid.UUID) (*KanbanBoardResponse, error) {
	project, err := s.repo.GetProjectByID(ctx, tenantID, projectID)
	if err != nil || project == nil {
		return nil, errors.New("project not found")
	}

	statuses, err := s.repo.ListWorkflowStatuses(ctx, project.WorkflowID)
	if err != nil {
		return nil, fmt.Errorf("failed to load workflow statuses: %w", err)
	}

	// Fetch issues (if scrum, fetch active sprint; if kanban, fetch all open issues)
	var issues []Issue
	if project.ProjectType == "scrum" {
		activeSprint, _ := s.repo.GetActiveSprint(ctx, projectID)
		if activeSprint != nil {
			issues, _ = s.repo.ListIssuesBySprint(ctx, projectID, activeSprint.ID)
		}
	} else {
		issues, _, _ = s.repo.ListIssuesByProject(ctx, tenantID, projectID, 200, 0)
	}

	// Group issues by status
	statusIssuesMap := make(map[uuid.UUID][]Issue)
	for _, issue := range issues {
		statusIssuesMap[issue.StatusID] = append(statusIssuesMap[issue.StatusID], issue)
	}

	columns := make([]KanbanColumn, len(statuses))
	for i, st := range statuses {
		colIssues := statusIssuesMap[st.ID]
		if colIssues == nil {
			colIssues = []Issue{}
		}
		columns[i] = KanbanColumn{
			StatusID: st.ID,
			Name:     st.Name,
			Category: st.Category,
			Position: st.Position,
			Issues:   colIssues,
		}
	}

	return &KanbanBoardResponse{
		Project: project,
		Columns: columns,
	}, nil
}

func (s *service) GetBacklog(ctx context.Context, tenantID, projectID uuid.UUID) (*BacklogResponse, error) {
	project, err := s.repo.GetProjectByID(ctx, tenantID, projectID)
	if err != nil || project == nil {
		return nil, errors.New("project not found")
	}

	sprints, err := s.repo.ListSprintsByProject(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch sprints: %w", err)
	}

	var activeSprintBucket *SprintBucket
	var futureSprintBuckets []SprintBucket

	for _, sprint := range sprints {
		issues, _ := s.repo.ListIssuesBySprint(ctx, projectID, sprint.ID)
		totalPts := 0
		for _, iss := range issues {
			if iss.StoryPoints != nil {
				totalPts += *iss.StoryPoints
			}
		}

		bucket := SprintBucket{
			Sprint:           sprint,
			Issues:           issues,
			TotalStoryPoints: totalPts,
		}

		if sprint.Status == "active" && activeSprintBucket == nil {
			activeSprintBucket = &bucket
		} else if sprint.Status == "future" {
			futureSprintBuckets = append(futureSprintBuckets, bucket)
		}
	}

	backlogIssues, err := s.repo.ListBacklogIssues(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch backlog issues: %w", err)
	}

	totalBacklogPts := 0
	for _, iss := range backlogIssues {
		if iss.StoryPoints != nil {
			totalBacklogPts += *iss.StoryPoints
		}
	}

	return &BacklogResponse{
		Project:             project,
		ActiveSprint:        activeSprintBucket,
		FutureSprints:       futureSprintBuckets,
		BacklogIssues:       backlogIssues,
		TotalBacklogPoints:  totalBacklogPts,
	}, nil
}

func (s *service) CreateWorklog(ctx context.Context, tenantID, issueID, employeeID uuid.UUID, req *CreateWorklogRequest) (*Worklog, error) {
	if valErr := req.Validate(); valErr != "" {
		return nil, errors.New(valErr)
	}

	issue, err := s.repo.GetIssueByID(ctx, tenantID, issueID)
	if err != nil || issue == nil {
		return nil, errors.New("issue not found")
	}

	worklog := &Worklog{
		ID:               uuid.New(),
		TenantID:         tenantID,
		IssueID:          issueID,
		EmployeeID:       employeeID,
		TimeSpentSeconds: req.TimeSpentSeconds,
		StartedAt:        req.StartedAt,
		Description:      req.Description,
		IsBillable:       req.IsBillable,
	}

	if err := s.repo.CreateWorklog(ctx, worklog); err != nil {
		return nil, fmt.Errorf("failed to create worklog: %w", err)
	}

	// Update remaining estimate if applicable
	newRemaining := issue.RemainingEstimateSeconds - req.TimeSpentSeconds
	if newRemaining < 0 {
		newRemaining = 0
	}
	_ = s.repo.UpdateIssue(ctx, &Issue{
		ID:                       issue.ID,
		TenantID:                 tenantID,
		Title:                    issue.Title,
		Description:              issue.Description,
		Priority:                 issue.Priority,
		AssigneeID:               issue.AssigneeID,
		SprintID:                 issue.SprintID,
		StoryPoints:              issue.StoryPoints,
		RemainingEstimateSeconds: newRemaining,
	})

	return worklog, nil
}

func (s *service) ListWorklogs(ctx context.Context, tenantID, issueID uuid.UUID) ([]Worklog, error) {
	return s.repo.ListWorklogsByIssue(ctx, tenantID, issueID)
}
