package work

import (
	"humora-backend/pkg/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes mounts all agile work management endpoints under /api/v1/work.
func RegisterRoutes(router fiber.Router, handler *Handler) {
	workGroup := router.Group("/work", middleware.AuthMiddleware())

	// Projects
	workGroup.Post("/projects", middleware.RequirePermission("work:write"), handler.CreateProject)
	workGroup.Get("/projects", handler.ListProjects)
	workGroup.Get("/projects/:id", handler.GetProject)
	workGroup.Get("/projects/:id/board", handler.GetKanbanBoard)
	workGroup.Get("/projects/:id/backlog", handler.GetBacklog)
	workGroup.Post("/projects/:id/sprints", middleware.RequirePermission("work:write"), handler.CreateSprint)
	workGroup.Get("/projects/:id/sprints", handler.ListSprints)
	workGroup.Get("/projects/:id/issues", handler.ListIssues)

	// Sprints
	workGroup.Put("/sprints/:id/status", middleware.RequirePermission("work:write"), handler.UpdateSprintStatus)

	// Issues
	workGroup.Post("/issues", handler.CreateIssue)
	workGroup.Get("/issues/:id", handler.GetIssue)
	workGroup.Patch("/issues/:id", handler.UpdateIssue)
	workGroup.Put("/issues/:id/transition", handler.TransitionIssue)

	// Worklogs
	workGroup.Post("/issues/:id/worklogs", handler.CreateWorklog)
	workGroup.Get("/issues/:id/worklogs", handler.ListWorklogs)
}
