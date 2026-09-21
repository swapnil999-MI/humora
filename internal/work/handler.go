package work

import (
	"humora-backend/internal/hrms"
	"humora-backend/pkg/pagination"
	"humora-backend/pkg/response"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	service  Service
	hrmsRepo hrms.Repository
}

func NewHandler(service Service, hrmsRepo hrms.Repository) *Handler {
	return &Handler{
		service:  service,
		hrmsRepo: hrmsRepo,
	}
}

func parseTenantAndUser(c *fiber.Ctx) (uuid.UUID, uuid.UUID, error) {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return uuid.Nil, uuid.Nil, fiber.ErrUnauthorized
	}
	tenantID, err := uuid.Parse(tenantIDRaw)
	if err != nil {
		return uuid.Nil, uuid.Nil, fiber.ErrUnauthorized
	}

	userIDRaw, ok := c.Locals("user_id").(string)
	if !ok || userIDRaw == "" {
		return uuid.Nil, uuid.Nil, fiber.ErrUnauthorized
	}
	userID, err := uuid.Parse(userIDRaw)
	if err != nil {
		return uuid.Nil, uuid.Nil, fiber.ErrUnauthorized
	}

	return tenantID, userID, nil
}

// CreateProject creates a new agile project.
func (h *Handler) CreateProject(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	p, err := h.service.CreateProject(c.UserContext(), tenantID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Project created successfully", p)
}

// GetProject returns a single project details.
func (h *Handler) GetProject(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid project ID format")
	}

	p, err := h.service.GetProject(c.UserContext(), tenantID, id)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	if p == nil {
		return response.Error(c, fiber.StatusNotFound, "Project not found")
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Project retrieved", p)
}

// ListProjects returns all agile projects.
func (h *Handler) ListProjects(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	p := pagination.ExtractPagination(c)
	projects, total, err := h.service.ListProjects(c.UserContext(), tenantID, p.Limit, p.Offset)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Projects retrieved", pagination.PaginatedResponse[Project]{
		Items: projects,
		Meta:  pagination.BuildMeta(total, p.Page, p.Limit),
	})
}

// GetKanbanBoard returns grouped columns and issues for interactive Kanban.
func (h *Handler) GetKanbanBoard(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid project ID")
	}

	board, err := h.service.GetKanbanBoard(c.UserContext(), tenantID, projectID)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Kanban board retrieved", board)
}

// GetBacklog returns active/future sprints and unassigned backlog issues.
func (h *Handler) GetBacklog(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid project ID")
	}

	backlog, err := h.service.GetBacklog(c.UserContext(), tenantID, projectID)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Agile backlog retrieved", backlog)
}

// CreateSprint initializes a sprint.
func (h *Handler) CreateSprint(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req CreateSprintRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	if req.ProjectID == "" {
		req.ProjectID = c.Params("id")
	}

	sprint, err := h.service.CreateSprint(c.UserContext(), tenantID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Sprint created", sprint)
}

// ListSprints lists all sprints of a project.
func (h *Handler) ListSprints(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid project ID")
	}

	sprints, err := h.service.ListSprints(c.UserContext(), tenantID, projectID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Sprints retrieved", sprints)
}

// UpdateSprintStatus starts, pauses, or completes a sprint.
func (h *Handler) UpdateSprintStatus(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	sprintID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid sprint ID")
	}

	var req UpdateSprintStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	sprint, err := h.service.UpdateSprintStatus(c.UserContext(), tenantID, sprintID, req.Status)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Sprint status updated", sprint)
}

// CreateIssue creates an agile issue with atomic key generation.
func (h *Handler) CreateIssue(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	emp, err := h.hrmsRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
	if err != nil || emp == nil {
		return response.Error(c, fiber.StatusBadRequest, "Reporter employee profile not found")
	}

	var req CreateIssueRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	issue, err := h.service.CreateIssue(c.UserContext(), tenantID, userID, emp.ID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Issue created successfully", issue)
}

// GetIssue fetches an issue by UUID or Key (e.g., 'HUM-101').
func (h *Handler) GetIssue(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	identifier := c.Params("id")
	var issue *Issue
	if parsedUUID, err := uuid.Parse(identifier); err == nil {
		issue, err = h.service.GetIssue(c.UserContext(), tenantID, parsedUUID)
	} else {
		issue, err = h.service.GetIssueByKey(c.UserContext(), tenantID, strings.ToUpper(identifier))
	}

	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	if issue == nil {
		return response.Error(c, fiber.StatusNotFound, "Issue not found")
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Issue retrieved", issue)
}

// ListIssues lists issues within a project.
func (h *Handler) ListIssues(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid project ID")
	}

	p := pagination.ExtractPagination(c)
	issues, total, err := h.service.ListIssues(c.UserContext(), tenantID, projectID, p.Limit, p.Offset)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Issues retrieved", pagination.PaginatedResponse[Issue]{
		Items: issues,
		Meta:  pagination.BuildMeta(total, p.Page, p.Limit),
	})
}

// TransitionIssue handles moving an issue across workflow statuses (e.g., drag & drop).
func (h *Handler) TransitionIssue(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	issueID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid issue ID")
	}

	var req TransitionIssueRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	if valErr := req.Validate(); valErr != "" {
		return response.Error(c, fiber.StatusBadRequest, valErr)
	}

	targetStatusUUID, _ := uuid.Parse(req.TargetStatusID)
	updated, err := h.service.TransitionIssue(c.UserContext(), tenantID, issueID, targetStatusUUID)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Issue status transitioned", updated)
}

// UpdateIssue modifies issue attributes.
func (h *Handler) UpdateIssue(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	issueID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid issue ID")
	}

	var req UpdateIssueRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	updated, err := h.service.UpdateIssue(c.UserContext(), tenantID, issueID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Issue updated", updated)
}

// CreateWorklog logs hours spent on an issue.
func (h *Handler) CreateWorklog(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	emp, err := h.hrmsRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
	if err != nil || emp == nil {
		return response.Error(c, fiber.StatusBadRequest, "Employee profile not found")
	}

	issueID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid issue ID")
	}

	var req CreateWorklogRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	worklog, err := h.service.CreateWorklog(c.UserContext(), tenantID, issueID, emp.ID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Work logged successfully", worklog)
}

// ListWorklogs retrieves time logs for an issue.
func (h *Handler) ListWorklogs(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	issueID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid issue ID")
	}

	worklogs, err := h.service.ListWorklogs(c.UserContext(), tenantID, issueID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Worklogs retrieved", worklogs)
}
