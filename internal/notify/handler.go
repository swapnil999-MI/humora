package notify

import (
	"strconv"
	"time"

	"humora-backend/pkg/middleware"
	"humora-backend/pkg/response"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Handler serves the signed-in user's own notifications.
type Handler struct{ db *sqlx.DB }

func NewHandler(db *sqlx.DB) *Handler { return &Handler{db: db} }

// RegisterRoutes mounts /notifications.
func RegisterRoutes(router fiber.Router, h *Handler) {
	g := router.Group("/notifications", middleware.AuthMiddleware())
	g.Get("/", h.List)
	g.Get("/unread-count", h.UnreadCount)
	g.Post("/read-all", h.MarkAllRead)
	g.Post("/:id/read", h.MarkRead)
	g.Delete("/", h.DeleteAll)
	g.Delete("/:id", h.Delete)
}

func currentUser(c *fiber.Ctx) (tenantID, userID uuid.UUID, ok bool) {
	t, err1 := uuid.Parse(asString(c.Locals("tenant_id")))
	u, err2 := uuid.Parse(asString(c.Locals("user_id")))
	return t, u, err1 == nil && err2 == nil
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

type listResponse struct {
	Items       []Notification `json:"items"`
	UnreadCount int            `json:"unread_count"`
}

// List returns the newest notifications (?limit=, ?before=<RFC3339 created_at> for older pages).
func (h *Handler) List(c *fiber.Ctx) error {
	tenantID, userID, ok := currentUser(c)
	if !ok {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	limit, _ := strconv.Atoi(c.Query("limit", "30"))
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	before := time.Now().Add(time.Minute)
	if b := c.Query("before"); b != "" {
		if t, err := time.Parse(time.RFC3339Nano, b); err == nil {
			before = t
		}
	}
	items := []Notification{}
	if err := h.db.SelectContext(c.UserContext(), &items, `
		SELECT id, category, title, body, link, entity_type, entity_id, created_at, read_at
		FROM notifications WHERE tenant_id = $1 AND user_id = $2 AND created_at < $3
		ORDER BY created_at DESC LIMIT $4`, tenantID, userID, before, limit); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "Could not load notifications {{"+err.Error()+"}}")
	}
	unread, err := h.unread(c, tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "Could not load notifications {{"+err.Error()+"}}")
	}
	return response.Success(c, fiber.StatusOK, "Notifications", listResponse{Items: items, UnreadCount: unread})
}

func (h *Handler) unread(c *fiber.Ctx, tenantID, userID uuid.UUID) (int, error) {
	var n int
	err := h.db.GetContext(c.UserContext(), &n,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`, tenantID, userID)
	return n, err
}

// UnreadCount is the cheap call for the badge.
func (h *Handler) UnreadCount(c *fiber.Ctx) error {
	tenantID, userID, ok := currentUser(c)
	if !ok {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	n, err := h.unread(c, tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "Could not count notifications {{"+err.Error()+"}}")
	}
	return response.Success(c, fiber.StatusOK, "Unread notifications", fiber.Map{"unread_count": n})
}

func (h *Handler) MarkRead(c *fiber.Ctx) error {
	tenantID, userID, ok := currentUser(c)
	if !ok {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid notification ID")
	}
	if _, err := h.db.ExecContext(c.UserContext(),
		`UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
		id, tenantID, userID); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "Could not update notification {{"+err.Error()+"}}")
	}
	return response.Success(c, fiber.StatusOK, "Marked as read", nil)
}

func (h *Handler) MarkAllRead(c *fiber.Ctx) error {
	tenantID, userID, ok := currentUser(c)
	if !ok {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	if _, err := h.db.ExecContext(c.UserContext(),
		`UPDATE notifications SET read_at = NOW() WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
		tenantID, userID); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "Could not update notifications {{"+err.Error()+"}}")
	}
	return response.Success(c, fiber.StatusOK, "All marked as read", nil)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	tenantID, userID, ok := currentUser(c)
	if !ok {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid notification ID")
	}
	if _, err := h.db.ExecContext(c.UserContext(),
		`DELETE FROM notifications WHERE id = $1 AND tenant_id = $2 AND user_id = $3`, id, tenantID, userID); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "Could not delete notification {{"+err.Error()+"}}")
	}
	return response.Success(c, fiber.StatusOK, "Deleted", nil)
}

// DeleteAll clears the user's notification list.
func (h *Handler) DeleteAll(c *fiber.Ctx) error {
	tenantID, userID, ok := currentUser(c)
	if !ok {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	if _, err := h.db.ExecContext(c.UserContext(),
		`DELETE FROM notifications WHERE tenant_id = $1 AND user_id = $2`, tenantID, userID); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "Could not clear notifications {{"+err.Error()+"}}")
	}
	return response.Success(c, fiber.StatusOK, "Cleared", nil)
}
