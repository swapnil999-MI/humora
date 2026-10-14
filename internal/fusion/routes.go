package fusion

import (
	"humora-backend/pkg/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes mounts fusion cross-domain endpoints under /api/v1/fusion.
func RegisterRoutes(router fiber.Router, handler *Handler) {
	fusionGroup := router.Group("/fusion", middleware.AuthMiddleware())

	// Team views and decisions belong to people who run teams; cost rates and
	// well-being profiles of colleagues are HR data. Superadmin passes every guard.
	teamLeads := middleware.RequireRole("admin", "hr_admin", "manager", "project_lead")
	peopleManagers := middleware.RequireRole("admin", "hr_admin", "manager")
	hrOnly := middleware.RequireRole("admin", "hr_admin")

	fusionGroup.Get("/my-workday", handler.GetMyWorkday)
	fusionGroup.Get("/team-capacity", teamLeads, handler.GetTeamCapacity)
	fusionGroup.Post("/quick-log", handler.QuickLogWork)
	fusionGroup.Put("/issues/:id/reassign", teamLeads, handler.ReassignIssue)

	// Engine 1: Leave-Aware Dynamic Sprint Capacity
	fusionGroup.Get("/sprint-capacity/:sprintId", handler.GetSprintCapacity)

	// Engine 2: Worklog-to-Timesheet Reconciliation & Approvals
	fusionGroup.Get("/timesheets/weekly", handler.GetWeeklyTimesheet)
	fusionGroup.Post("/timesheets/submit", handler.SubmitWeeklyTimesheet)
	fusionGroup.Put("/timesheets/:id/review", peopleManagers, handler.ReviewWeeklyTimesheet)
	fusionGroup.Get("/timesheets/team", peopleManagers, handler.ListTeamTimesheets)

	// Engine 3: Real-Time Feature & Epic Cost Engine
	fusionGroup.Get("/cost-analysis", hrOnly, handler.GetCostAnalysis)

	// Engine 4: Developer Well-Being & Burnout Sentinel
	fusionGroup.Get("/burnout-sentinel", peopleManagers, handler.GetBurnoutSentinel)
}
