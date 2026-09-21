package hrms

import (
	"humora-backend/pkg/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes mounts all protected and public HRMS endpoints under /api/v1/hrms.
func RegisterRoutes(router fiber.Router, handler *Handler, onboardingHandler *OnboardingHandler, payrollHandler *PayrollHandler) {
	// Public Candidate Onboarding Portal (Access via unique invite token)
	candidateGroup := router.Group("/hrms/onboarding/candidate")
	candidateGroup.Get("/:token", onboardingHandler.GetCandidateByToken)
	candidateGroup.Put("/:token", onboardingHandler.SaveCandidateDossier)

	hrmsGroup := router.Group("/hrms", middleware.AuthMiddleware())

	// Employee Self-Service (ESS) Profile Management
	profileGroup := hrmsGroup.Group("/profile")
	profileGroup.Get("/me", onboardingHandler.GetMyProfile)
	profileGroup.Put("/me", onboardingHandler.UpdateMyProfile)
	profileGroup.Post("/upload", onboardingHandler.UploadProfileMedia)

	// HR Onboarding Management Pipeline
	onboardGroup := hrmsGroup.Group("/onboarding")
	onboardGroup.Get("/pipeline", onboardingHandler.ListOnboardingCandidates)
	onboardGroup.Post("/invite", onboardingHandler.InviteCandidate)
	onboardGroup.Post("/candidates/:id/convert", onboardingHandler.ApproveAndConvertCandidate)

	// Employees & Organization Directory
	empGroup := hrmsGroup.Group("/employees")
	empGroup.Post("/", middleware.RequirePermission("hrms:write"), handler.CreateEmployee)
	empGroup.Get("/", handler.ListEmployees)
	empGroup.Get("/org-tree", handler.GetOrgTree)
	empGroup.Get("/:id", handler.GetEmployee)
	empGroup.Post("/:id/biometric-face", middleware.RequirePermission("hrms:write"), handler.UpdateEmployeeBiometricFace)

	// Attendance & Geofenced Punch Desk
	attGroup := hrmsGroup.Group("/attendance")
	attGroup.Post("/punch", handler.Punch)
	attGroup.Post("/punch-with-face", handler.PunchWithFace)
	attGroup.Get("/summary", handler.GetAttendanceSummary)
	attGroup.Get("/session", handler.GetAttendanceSession)
	attGroup.Get("/calendar", handler.GetMonthlyAttendance)
	attGroup.Get("/radar", handler.GetTeamPresenceRadar)
	attGroup.Post("/regularizations", handler.CreateRegularization)
	attGroup.Get("/regularizations/mine", handler.ListMyRegularizations)
	attGroup.Get("/regularizations/team", handler.ListTeamRegularizations)
	attGroup.Put("/regularizations/:id/review", handler.ReviewRegularization)

	// Shift Creation & Shift Rostering Desk
	shiftGroup := hrmsGroup.Group("/shifts")
	shiftGroup.Get("/", handler.ListShifts)
	shiftGroup.Post("/", handler.CreateShift)
	shiftGroup.Put("/:id", handler.UpdateShift)
	shiftGroup.Delete("/:id", handler.DeleteShift)
	shiftGroup.Get("/rosters", handler.ListEmployeeRosters)
	shiftGroup.Post("/assign", handler.AssignShift)
	shiftGroup.Post("/assign-bulk", handler.BulkAssignShift)

	// Leave & Absence Desk (with Sandwich Rule)
	leaveGroup := hrmsGroup.Group("/leaves")
	leaveGroup.Get("/types", handler.ListLeaveTypes)
	leaveGroup.Post("/preview", handler.PreviewLeave)
	leaveGroup.Post("/apply", handler.ApplyLeave)
	leaveGroup.Get("/my-requests", handler.ListMyLeaves)
	leaveGroup.Get("/all", middleware.RequirePermission("hrms:write"), handler.ListAllLeaves)
	leaveGroup.Get("/balances", handler.ListLeaveBalances)
	leaveGroup.Put("/requests/:id/status", middleware.RequirePermission("hrms:write"), handler.ApproveOrRejectLeave)

	// Automated Payroll & Statutory Compensation Engine
	payrollGroup := hrmsGroup.Group("/payroll")
	payrollGroup.Get("/runs", payrollHandler.ListPayrollRuns)
	payrollGroup.Post("/runs/preview", middleware.RequirePermission("hrms:write"), payrollHandler.PreviewPayrollRun)
	payrollGroup.Get("/runs/preview", middleware.RequirePermission("hrms:write"), payrollHandler.PreviewPayrollRun)
	payrollGroup.Post("/runs/execute", middleware.RequirePermission("hrms:write"), payrollHandler.ExecutePayrollRun)
	payrollGroup.Get("/payslips/mine", payrollHandler.ListMyPayslips)
	payrollGroup.Get("/payslips/:id", payrollHandler.GetPayslip)
	payrollGroup.Get("/compensation/me", payrollHandler.GetMyCompensation)
	payrollGroup.Get("/tax/declaration", payrollHandler.GetMyITDeclaration)
	payrollGroup.Post("/tax/declaration", payrollHandler.SaveITDeclaration)
	payrollGroup.Get("/reimbursements", payrollHandler.ListReimbursements)
	payrollGroup.Post("/reimbursements", payrollHandler.SubmitReimbursement)
}

