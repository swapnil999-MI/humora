package fusion

import (
	"humora-backend/pkg/response"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
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

// GetMyWorkday returns aggregated daily shift & focus issues for employee cockpit.
func (h *Handler) GetMyWorkday(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	res, err := h.service.GetMyWorkday(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "My workday retrieved", res)
}

// GetTeamCapacity returns manager copilot team presence & workload distribution.
func (h *Handler) GetTeamCapacity(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	res, err := h.service.GetTeamCapacity(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Team capacity retrieved", res)
}

// QuickLogWork logs time against an assigned issue with one click.
func (h *Handler) QuickLogWork(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req struct {
		IssueID          string `json:"issue_id"`
		TimeSpentSeconds int    `json:"time_spent_seconds"`
		Description      string `json:"description"`
	}
	if err := c.BodyParser(&req); err != nil || req.IssueID == "" || req.TimeSpentSeconds <= 0 {
		return response.Error(c, fiber.StatusBadRequest, "issue_id and time_spent_seconds > 0 required")
	}

	issueUUID, err := uuid.Parse(req.IssueID)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid issue_id")
	}

	if err := h.service.QuickLogWork(c.UserContext(), tenantID, userID, issueUUID, req.TimeSpentSeconds, req.Description); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Time logged successfully", nil)
}

// ReassignIssue updates the assignee of an issue.
func (h *Handler) ReassignIssue(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	issueUUID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid issue ID")
	}

	var req struct {
		TargetAssigneeID string `json:"target_assignee_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.TargetAssigneeID == "" {
		return response.Error(c, fiber.StatusBadRequest, "target_assignee_id is required")
	}

	assigneeUUID, err := uuid.Parse(req.TargetAssigneeID)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid target_assignee_id")
	}

	if err := h.service.ReassignIssue(c.UserContext(), tenantID, issueUUID, assigneeUUID); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Issue reassigned successfully", nil)
}

// 1. Leave-Aware Dynamic Sprint Capacity
// GET /api/v1/fusion/sprint-capacity/:sprintId
func (h *Handler) GetSprintCapacity(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	sprintID, err := uuid.Parse(c.Params("sprintId"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid sprint ID")
	}

	res, err := h.service.GetSprintCapacity(c.UserContext(), tenantID, sprintID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Sprint capacity analysis retrieved", res)
}

// 2. Worklog-to-Timesheet Reconciliation
// GET /api/v1/fusion/timesheets/weekly?week_start=2026-09-14
func (h *Handler) GetWeeklyTimesheet(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	weekStart := c.Query("week_start")
	res, err := h.service.GetWeeklyTimesheet(c.UserContext(), tenantID, userID, weekStart)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Weekly timesheet retrieved", res)
}

// POST /api/v1/fusion/timesheets/submit
func (h *Handler) SubmitWeeklyTimesheet(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req SubmitTimesheetRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid submission payload")
	}

	res, err := h.service.SubmitWeeklyTimesheet(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Weekly timesheet submitted for manager review", res)
}

// PUT /api/v1/fusion/timesheets/:id/review
func (h *Handler) ReviewWeeklyTimesheet(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	subID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid timesheet submission ID")
	}

	var req ReviewTimesheetRequest
	if err := c.BodyParser(&req); err != nil || (req.Status != "approved" && req.Status != "rejected") {
		return response.Error(c, fiber.StatusBadRequest, "Status must be 'approved' or 'rejected'")
	}

	if err := h.service.ReviewWeeklyTimesheet(c.UserContext(), tenantID, userID, subID, &req); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Timesheet status updated successfully", nil)
}

// GET /api/v1/fusion/timesheets/team
func (h *Handler) ListTeamTimesheets(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	status := c.Query("status")
	res, err := h.service.ListTeamTimesheets(c.UserContext(), tenantID, status)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Team timesheets retrieved", res)
}

// 3. Real-Time Feature & Epic Cost Engine
// GET /api/v1/fusion/cost-analysis?project_id=...
func (h *Handler) GetCostAnalysis(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var projIDPtr *uuid.UUID
	projIDStr := c.Query("project_id")
	if projIDStr != "" {
		parsed, err := uuid.Parse(projIDStr)
		if err == nil {
			projIDPtr = &parsed
		}
	}

	res, err := h.service.GetCostAnalysis(c.UserContext(), tenantID, projIDPtr)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Feature and epic cost analysis retrieved", res)
}

// 4. Developer Well-Being & Burnout Sentinel
// GET /api/v1/fusion/burnout-sentinel
func (h *Handler) GetBurnoutSentinel(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	res, err := h.service.GetBurnoutSentinel(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Developer burnout sentinel report retrieved", res)
}
