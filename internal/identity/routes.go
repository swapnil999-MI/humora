package identity

import (
	"humora-backend/pkg/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes registers public and protected authentication & identity endpoints.
func RegisterRoutes(router fiber.Router, handler *Handler) {
	authGroup := router.Group("/auth")

	// Public Routes
	authGroup.Post("/register", handler.Register)
	authGroup.Post("/login", handler.Login)
	authGroup.Post("/refresh", handler.RefreshToken)

	// Protected Routes (Require Valid Session Token)
	protected := authGroup.Group("/", middleware.AuthMiddleware())
	protected.Get("/me", handler.GetProfile)
	protected.Put("/presence", handler.UpdatePresence)
	protected.Post("/device-key", handler.RegisterDeviceKey)
}
