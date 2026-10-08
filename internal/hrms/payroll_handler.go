package hrms

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"humora-backend/pkg/response"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type PayrollHandler struct {
	service PayrollService
	empRepo Repository
}

func NewPayrollHandler(service PayrollService, empRepo Repository) *PayrollHandler {
	return &PayrollHandler{
		service: service,
		empRepo: empRepo,
	}
}

// PreviewPayrollRun calculates attendance, LOPs, and proration preview before final run.
// POST /api/v1/hrms/payroll/preview or GET /api/v1/hrms/payroll/preview?month=9&year=2026
func (h *PayrollHandler) PreviewPayrollRun(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var month, year int
	if c.Method() == fiber.MethodPost {
		var req PreviewPayrollRequest
		if err := c.BodyParser(&req); err == nil && req.Month > 0 {
			month = req.Month
			year = req.Year
		}
	}

	if month == 0 {
		mStr := c.Query("month")
		yStr := c.Query("year")
		month, _ = strconv.Atoi(mStr)
		year, _ = strconv.Atoi(yStr)
	}

	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}

	preview, err := h.service.PreviewPayrollRun(c.UserContext(), tenantID, month, year)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Payroll preview generated successfully", preview)
}

// ExecutePayrollRun finalizes monthly payroll, locks payslips, and records accounting batch.
// POST /api/v1/hrms/payroll/execute
func (h *PayrollHandler) ExecutePayrollRun(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req ExecutePayrollRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid request payload")
	}

	if req.Month == 0 {
		req.Month = int(time.Now().Month())
	}
	if req.Year == 0 {
		req.Year = time.Now().Year()
	}

	res, err := h.service.ExecutePayrollRun(c.UserContext(), tenantID, userID, req.Month, req.Year)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Monthly payroll executed and finalized successfully", res)
}

// ListPayrollRuns fetches all finalized and drafted monthly payroll runs.
// GET /api/v1/hrms/payroll/runs
func (h *PayrollHandler) ListPayrollRuns(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	runs, err := h.service.ListPayrollRuns(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Payroll runs retrieved", runs)
}

// ListMyPayslips lists historical generated payslips for the authenticated employee.
// GET /api/v1/hrms/payroll/payslips/mine
func (h *PayrollHandler) ListMyPayslips(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	emp, err := h.empRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, "Employee record not found for user")
	}

	payslips, err := h.service.ListEmployeePayslips(c.UserContext(), tenantID, emp.ID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Historical payslips retrieved", payslips)
}

// GetPayslip retrieves an itemized payslip document by ID.
// GET /api/v1/hrms/payroll/payslips/:id
func (h *PayrollHandler) GetPayslip(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	payslipID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid payslip ID")
	}

	payslip, err := h.service.GetPayslipByID(c.UserContext(), tenantID, payslipID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, err.Error())
	}

	// Employees may only read their own payslips; payroll management may read any in the tenant.
	role, _ := c.Locals("role").(string)
	if role != "superadmin" && role != "admin" && role != "hr_admin" {
		emp, err := h.empRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
		if err != nil || emp.ID != payslip.EmployeeID {
			return response.Error(c, fiber.StatusNotFound, "Payslip not found")
		}
	}

	return response.Success(c, fiber.StatusOK, "Payslip details retrieved", payslip)
}

// GetMyCompensation retrieves the authenticated employee's active salary compensation breakdown.
// GET /api/v1/hrms/payroll/compensation/me
func (h *PayrollHandler) GetMyCompensation(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	emp, err := h.empRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, "Employee profile not found")
	}

	comp, err := h.service.GetMyCompensationStructure(c.UserContext(), tenantID, emp.ID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Compensation structure retrieved", comp)
}

// SaveITDeclaration saves or updates an employee's annual tax investment declaration.
// POST /api/v1/hrms/payroll/tax/declaration
func (h *PayrollHandler) SaveITDeclaration(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	emp, err := h.empRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, "Employee record not found")
	}

	var req SaveITDeclarationRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid declaration payload")
	}

	decl, err := h.service.SaveITDeclaration(c.UserContext(), tenantID, emp.ID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Tax declaration saved and TDS adjusted successfully", decl)
}

// GetMyITDeclaration fetches the active tax declaration for current financial year.
// GET /api/v1/hrms/payroll/tax/declaration
func (h *PayrollHandler) GetMyITDeclaration(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	emp, err := h.empRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, "Employee record not found")
	}

	fy := c.Query("fy")
	if fy == "" {
		// Calculate current Indian FY (e.g. Apr 2026 - Mar 2027 => "2026-2027")
		now := time.Now()
		if now.Month() < 4 {
			fy = strconv.Itoa(now.Year()-1) + "-" + strconv.Itoa(now.Year())
		} else {
			fy = strconv.Itoa(now.Year()) + "-" + strconv.Itoa(now.Year()+1)
		}
	}

	decl, err := h.service.GetITDeclaration(c.UserContext(), tenantID, emp.ID, fy)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "IT Declaration retrieved", decl)
}

// SubmitReimbursement handles employee submission of flexible benefits claim.
// POST /api/v1/hrms/payroll/reimbursements
func (h *PayrollHandler) SubmitReimbursement(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	emp, err := h.empRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, "Employee record not found")
	}

	var req SubmitReimbursementRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid reimbursement claim payload")
	}

	claim, err := h.service.SubmitReimbursement(c.UserContext(), tenantID, emp.ID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusCreated, "Reimbursement claim submitted successfully", claim)
}

// ListReimbursements lists all reimbursement claims submitted by the employee.
// GET /api/v1/hrms/payroll/reimbursements
func (h *PayrollHandler) ListReimbursements(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	emp, err := h.empRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, "Employee record not found")
	}

	claims, err := h.service.ListReimbursements(c.UserContext(), tenantID, emp.ID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Reimbursement claims retrieved", claims)
}

// ListTeamReimbursements lists the organisation's claims for review (management only).
// GET /api/v1/hrms/payroll/reimbursements/team?status=pending
func (h *PayrollHandler) ListTeamReimbursements(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	claims, err := h.service.ListTeamReimbursements(c.UserContext(), tenantID, c.Query("status", "pending"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Reimbursement claims retrieved", claims)
}

type reviewReimbursementRequest struct {
	Status string `json:"status"` // approved | rejected
}

// ReviewReimbursement approves or rejects a pending claim (management only).
// PUT /api/v1/hrms/payroll/reimbursements/:id/review
func (h *PayrollHandler) ReviewReimbursement(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	claimID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid claim ID")
	}
	var req reviewReimbursementRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid review payload")
	}
	reviewerName, _ := c.Locals("email").(string)
	var reviewerEmployeeID *uuid.UUID
	if emp, err := h.empRepo.GetEmployeeByUserID(c.UserContext(), tenantID, userID); err == nil {
		reviewerName = strings.TrimSpace(emp.FirstName + " " + emp.LastName)
		reviewerEmployeeID = &emp.ID
	}
	claim, err := h.service.ReviewReimbursement(c.UserContext(), tenantID, claimID, userID, reviewerEmployeeID, reviewerName, req.Status)
	if errors.Is(err, ErrClaimNotPending) {
		return response.Error(c, fiber.StatusConflict, err.Error())
	}
	if errors.Is(err, ErrOwnClaim) {
		return response.Error(c, fiber.StatusForbidden, err.Error())
	}
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Claim "+claim.Status, claim)
}
