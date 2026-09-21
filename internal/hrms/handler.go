package hrms

import (
	"log"
	"strconv"
	"strings"

	"humora-backend/pkg/pagination"
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
	tenantIDStr, _ := c.Locals("tenant_id").(string)
	userIDStr, _ := c.Locals("user_id").(string)

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	return tenantID, userID, nil
}

// CreateEmployee handles onboarding new staff.
func (h *Handler) CreateEmployee(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req CreateEmployeeRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	emp, err := h.service.CreateEmployee(c.UserContext(), tenantID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Employee created successfully", emp)
}

// ListEmployees retrieves employees with pagination, search, and department filter.
func (h *Handler) ListEmployees(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	p := pagination.ExtractPagination(c)
	deptID := c.Query("department_id", "")

	employees, total, err := h.service.ListEmployees(c.UserContext(), tenantID, p.Search, deptID, p.Limit, p.Offset)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Employees retrieved", pagination.PaginatedResponse[Employee]{
		Items: employees,
		Meta:  pagination.BuildMeta(total, p.Page, p.Limit),
	})
}

// GetEmployee retrieves a single employee by ID.
func (h *Handler) GetEmployee(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid employee ID")
	}

	emp, err := h.service.GetEmployee(c.UserContext(), tenantID, id)
	if err != nil || emp == nil {
		return response.Error(c, fiber.StatusNotFound, "Employee not found")
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Employee retrieved", emp)
}

// GetOrgTree returns the hierarchical canvas org chart.
func (h *Handler) GetOrgTree(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	tree, err := h.service.GetOrgTree(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Org chart tree retrieved", tree)
}

// Punch handles geofenced / offline attendance punches.
func (h *Handler) Punch(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req PunchRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	res, err := h.service.RecordPunch(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Attendance punch recorded", res)
}

// GetAttendanceSummary returns today's work hours and punch status.
func (h *Handler) GetAttendanceSummary(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	summary, err := h.service.GetAttendanceSummary(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Attendance summary retrieved", summary)
}

// PreviewLeave calculates sandwich leave days before applying.
func (h *Handler) PreviewLeave(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req ApplyLeaveRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	preview, err := h.service.PreviewLeave(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Leave calculation preview", preview)
}

// ApplyLeave submits a leave application.
func (h *Handler) ApplyLeave(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req ApplyLeaveRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	leaveReq, err := h.service.ApplyLeave(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Leave request submitted successfully", leaveReq)
}

// ApproveOrRejectLeave handles manager approval/rejection.
func (h *Handler) ApproveOrRejectLeave(c *fiber.Ctx) error {
	tenantID, approverUserID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	reqID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid leave request ID")
	}

	var body struct {
		Status string `json:"status"` // 'approved', 'rejected'
	}
	if err := c.BodyParser(&body); err != nil || (body.Status != "approved" && body.Status != "rejected") {
		return response.Error(c, fiber.StatusBadRequest, "status must be 'approved' or 'rejected'")
	}

	updatedReq, err := h.service.ApproveOrRejectLeave(c.UserContext(), tenantID, reqID, approverUserID, body.Status)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Leave status updated successfully", updatedReq)
}

// ListMyLeaves returns the current employee's leave requests.
func (h *Handler) ListMyLeaves(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	p := pagination.ExtractPagination(c)
	requests, total, err := h.service.ListMyLeaves(c.UserContext(), tenantID, userID, p.Limit, p.Offset)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Leave requests retrieved", pagination.PaginatedResponse[LeaveRequest]{
		Items: requests,
		Meta:  pagination.BuildMeta(total, p.Page, p.Limit),
	})
}

// ListAllLeaves returns all company leave requests for manager/admin approvals.
func (h *Handler) ListAllLeaves(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	p := pagination.ExtractPagination(c)
	requests, total, err := h.service.ListAllLeaveRequests(c.UserContext(), tenantID, p.Limit, p.Offset)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "All leave requests retrieved", pagination.PaginatedResponse[LeaveRequest]{
		Items: requests,
		Meta:  pagination.BuildMeta(total, p.Page, p.Limit),
	})
}

// ListLeaveBalances returns remaining leave credits.
func (h *Handler) ListLeaveBalances(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	balances, err := h.service.ListLeaveBalances(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Leave balances retrieved", balances)
}

// ListLeaveTypes returns all leave policy types for the tenant.
func (h *Handler) ListLeaveTypes(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	types, err := h.service.ListLeaveTypes(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Leave types retrieved", types)
}

// CreateShift handles creating a corporate work shift.
func (h *Handler) CreateShift(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req CreateShiftRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	shift, err := h.service.CreateShift(c.UserContext(), tenantID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Shift created successfully", shift)
}

// ListShifts returns all shifts for the tenant.
func (h *Handler) ListShifts(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	shifts, err := h.service.ListShifts(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Shifts retrieved", shifts)
}

// UpdateShift updates an existing shift.
func (h *Handler) UpdateShift(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	shiftID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid shift ID")
	}

	var req CreateShiftRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	shift, err := h.service.UpdateShift(c.UserContext(), tenantID, shiftID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Shift updated successfully", shift)
}

// DeleteShift deletes a shift.
func (h *Handler) DeleteShift(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	shiftID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid shift ID")
	}

	if err := h.service.DeleteShift(c.UserContext(), tenantID, shiftID); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Shift deleted successfully", nil)
}

// AssignShift assigns an employee to a shift starting on an effective date.
func (h *Handler) AssignShift(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req AssignShiftRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	if err := h.service.AssignShift(c.UserContext(), tenantID, &req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Shift assigned successfully", nil)
}

// BulkAssignShift assigns multiple employees to a shift.
func (h *Handler) BulkAssignShift(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req BulkAssignShiftRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	if err := h.service.BulkAssignShift(c.UserContext(), tenantID, &req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Shifts bulk assigned successfully", nil)
}

// ListEmployeeRosters returns roster assignments for all active employees.
func (h *Handler) ListEmployeeRosters(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	rosters, err := h.service.ListEmployeeRosters(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Employee shift rosters retrieved", rosters)
}

// GetAttendanceSession returns real-time session telemetry for the punch desk terminal.
func (h *Handler) GetAttendanceSession(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	session, err := h.service.GetAttendanceSession(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Attendance session retrieved", session)
}

// GetMonthlyAttendance returns month-wise presence calendar matrix with Zero Sandwich policy.
func (h *Handler) GetMonthlyAttendance(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	year, _ := strconv.Atoi(c.Query("year"))
	month, _ := strconv.Atoi(c.Query("month"))

	matrix, err := h.service.GetMonthlyAttendance(c.UserContext(), tenantID, userID, year, month)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Monthly attendance matrix retrieved", matrix)
}

// GetTeamPresenceRadar returns real-time presence of all colleagues.
func (h *Handler) GetTeamPresenceRadar(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	radar, err := h.service.GetTeamPresenceRadar(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Team presence radar retrieved", radar)
}

// CreateRegularization submits a missed punch, on-duty, or WFH request.
func (h *Handler) CreateRegularization(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req CreateRegularizationRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	reg, err := h.service.CreateRegularization(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Regularization request submitted", reg)
}

// ListMyRegularizations lists personal regularizations for the logged-in employee.
func (h *Handler) ListMyRegularizations(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	status := c.Query("status", "")
	regs, err := h.service.ListMyRegularizations(c.UserContext(), tenantID, userID, status)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Personal regularizations retrieved", regs)
}

// ListTeamRegularizations lists regularizations for manager approval queue.
func (h *Handler) ListTeamRegularizations(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	status := c.Query("status", "")
	regs, err := h.service.ListTeamRegularizations(c.UserContext(), tenantID, status)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Team regularizations retrieved", regs)
}

// ReviewRegularization approves or rejects an attendance regularization.
func (h *Handler) ReviewRegularization(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	regID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid regularization ID")
	}

	var req ReviewRegularizationRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	reg, err := h.service.ReviewRegularization(c.UserContext(), tenantID, regID, userID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Regularization status updated", reg)
}

// UpdateEmployeeBiometricFace allows management to register or update an employee's master facial profile.
func (h *Handler) UpdateEmployeeBiometricFace(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	empID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid employee ID")
	}

	var req EnrollBiometricFaceRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	res, err := h.service.UpdateEmployeeBiometricFace(c.UserContext(), tenantID, empID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Biometric face profile registered successfully", res)
}

// PunchWithFace verifies employee selfie and records biometric check-in/check-out.
func (h *Handler) PunchWithFace(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req PunchWithFaceRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	res, err := h.service.PunchWithFace(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "Presentation attack") {
			log.Printf("[SECURITY ALERT] Biometric Presentation Attack Blocked (Tenant: %s, User: %s): %s", tenantID, userID, errStr)
			return response.Error(c, fiber.StatusForbidden, errStr)
		}
		if strings.Contains(errStr, "No human face detected") || strings.Contains(errStr, "facial features") || strings.Contains(errStr, "blurry") || strings.Contains(errStr, "dark") || strings.Contains(errStr, "resolution") {
			return response.Error(c, fiber.StatusBadRequest, errStr)
		}
		return response.Error(c, fiber.StatusForbidden, errStr)
	}

	return response.TypedSuccess(c, fiber.StatusOK, res.Message, res)
}


