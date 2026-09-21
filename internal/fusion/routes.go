package fusion

import (
	"humora-backend/pkg/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes mounts fusion cross-domain endpoints under /api/v1/fusion.
func RegisterRoutes(router fiber.Router, handler *Handler) {
	fusionGroup := router.Group("/fusion", middleware.AuthMiddleware())

	fusionGroup.Get("/my-workday", handler.GetMyWorkday)
	fusionGroup.Get("/team-capacity", handler.GetTeamCapacity)
	fusionGroup.Post("/quick-log", handler.QuickLogWork)
	fusionGroup.Put("/issues/:id/reassign", handler.ReassignIssue)

	// Engine 1: Leave-Aware Dynamic Sprint Capacity
	fusionGroup.Get("/sprint-capacity/:sprintId", handler.GetSprintCapacity)

	// Engine 2: Worklog-to-Timesheet Reconciliation & Approvals
	fusionGroup.Get("/timesheets/weekly", handler.GetWeeklyTimesheet)
	fusionGroup.Post("/timesheets/submit", handler.SubmitWeeklyTimesheet)
	fusionGroup.Put("/timesheets/:id/review", handler.ReviewWeeklyTimesheet)
	fusionGroup.Get("/timesheets/team", handler.ListTeamTimesheets)

	// Engine 3: Real-Time Feature & Epic Cost Engine
	fusionGroup.Get("/cost-analysis", handler.GetCostAnalysis)

	// Engine 4: Developer Well-Being & Burnout Sentinel
	fusionGroup.Get("/burnout-sentinel", handler.GetBurnoutSentinel)
}
