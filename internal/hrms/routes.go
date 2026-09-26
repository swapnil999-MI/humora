package hrms

import (
	"humora-backend/pkg/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes mounts all protected and public HRMS endpoints under /api/v1/hrms.
func RegisterRoutes(router fiber.Router, handler *Handler, onboardingHandler *OnboardingHandler, payrollHandler *PayrollHandler, companyHandler *CompanyHandler) {
	// Public Candidate Onboarding Portal (Access via unique invite token)
	candidateGroup := router.Group("/hrms/onboarding/candidate")
	candidateGroup.Get("/:token", onboardingHandler.GetCandidateByToken)
	candidateGroup.Put("/:token", onboardingHandler.SaveCandidateDossier)

	hrmsGroup := router.Group("/hrms", middleware.AuthMiddleware())

	// Management Role Guard (superadmin, admin, hr_admin)
	managementOnly := middleware.RequireRole("superadmin", "admin", "hr_admin")

	// Corporate Profile & Tenant SMTP Gateway (Management Only)
	if companyHandler != nil {
		companyGroup := hrmsGroup.Group("/company", managementOnly)
		companyGroup.Get("/profile", companyHandler.GetCompanyProfile)
		companyGroup.Put("/profile", companyHandler.UpdateCompanyProfile)
		companyGroup.Get("/smtp", companyHandler.GetSMTPConfig)
		companyGroup.Put("/smtp", companyHandler.SaveSMTPConfig)
		companyGroup.Post("/smtp/test", companyHandler.TestSMTPConfig)
		companyGroup.Get("/smtp/test", companyHandler.TestSMTPConfig)
	}

	// Employee Self-Service (ESS) Profile Management
	profileGroup := hrmsGroup.Group("/profile")
	profileGroup.Get("/me", onboardingHandler.GetMyProfile)
	profileGroup.Put("/me", onboardingHandler.UpdateMyProfile)
	profileGroup.Post("/upload", onboardingHandler.UploadProfileMedia)

	// HR Onboarding Management Pipeline (Management Only)
	onboardGroup := hrmsGroup.Group("/onboarding", managementOnly)
	onboardGroup.Get("/pipeline", onboardingHandler.ListOnboardingCandidates)
	onboardGroup.Get("/candidates/:id", onboardingHandler.GetCandidateByID)
	onboardGroup.Post("/invite", onboardingHandler.InviteCandidate)
	onboardGroup.Post("/candidates/:id/convert", onboardingHandler.ApproveAndConvertCandidate)

	// Employees & Organization Directory
	empGroup := hrmsGroup.Group("/employees")
	empGroup.Post("/", managementOnly, handler.CreateEmployee)
	empGroup.Get("/", handler.ListEmployees)
	empGroup.Get("/org-tree", handler.GetOrgTree)
	empGroup.Get("/:id", handler.GetEmployee)
	empGroup.Post("/:id/biometric-face", managementOnly, handler.UpdateEmployeeBiometricFace)

	// Attendance & Geofenced Punch Desk
	attGroup := hrmsGroup.Group("/attendance")
	attGroup.Post("/punch", handler.Punch)
	attGroup.Post("/punch-with-face", handler.PunchWithFace)
	attGroup.Get("/summary", handler.GetAttendanceSummary)
	attGroup.Get("/session", handler.GetAttendanceSession)
	attGroup.Get("/calendar", handler.GetMonthlyAttendance)
	attGroup.Get("/radar", managementOnly, handler.GetTeamPresenceRadar)
	attGroup.Post("/regularizations", handler.CreateRegularization)
	attGroup.Get("/regularizations/mine", handler.ListMyRegularizations)
	attGroup.Get("/regularizations/team", managementOnly, handler.ListTeamRegularizations)
	attGroup.Put("/regularizations/:id/review", managementOnly, handler.ReviewRegularization)

	// Shift Creation & Shift Rostering Desk
	shiftGroup := hrmsGroup.Group("/shifts")
	shiftGroup.Get("/", handler.ListShifts)
	shiftGroup.Post("/", managementOnly, handler.CreateShift)
	shiftGroup.Put("/:id", managementOnly, handler.UpdateShift)
	shiftGroup.Delete("/:id", managementOnly, handler.DeleteShift)
	shiftGroup.Get("/rosters", handler.ListEmployeeRosters)
	shiftGroup.Post("/assign", managementOnly, handler.AssignShift)
	shiftGroup.Post("/assign-bulk", managementOnly, handler.BulkAssignShift)

	// Leave & Absence Desk (with Sandwich Rule)
	leaveGroup := hrmsGroup.Group("/leaves")
	leaveGroup.Get("/types", handler.ListLeaveTypes)
	leaveGroup.Post("/preview", handler.PreviewLeave)
	leaveGroup.Post("/apply", handler.ApplyLeave)
	leaveGroup.Get("/my-requests", handler.ListMyLeaves)
	leaveGroup.Get("/all", managementOnly, handler.ListAllLeaves)
	leaveGroup.Get("/balances", handler.ListLeaveBalances)
	leaveGroup.Put("/requests/:id/status", managementOnly, handler.ApproveOrRejectLeave)

	// Automated Payroll & Statutory Compensation Engine
	payrollGroup := hrmsGroup.Group("/payroll")
	payrollGroup.Get("/runs", managementOnly, payrollHandler.ListPayrollRuns)
	payrollGroup.Post("/runs/preview", managementOnly, payrollHandler.PreviewPayrollRun)
	payrollGroup.Get("/runs/preview", managementOnly, payrollHandler.PreviewPayrollRun)
	payrollGroup.Post("/runs/execute", managementOnly, payrollHandler.ExecutePayrollRun)
	payrollGroup.Get("/payslips/mine", payrollHandler.ListMyPayslips)
	payrollGroup.Get("/payslips/:id", payrollHandler.GetPayslip)
	payrollGroup.Get("/compensation/me", payrollHandler.GetMyCompensation)
	payrollGroup.Get("/tax/declaration", payrollHandler.GetMyITDeclaration)
	payrollGroup.Post("/tax/declaration", payrollHandler.SaveITDeclaration)
	payrollGroup.Get("/reimbursements", payrollHandler.ListReimbursements)
	payrollGroup.Post("/reimbursements", payrollHandler.SubmitReimbursement)
}

