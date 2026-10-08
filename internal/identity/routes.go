package identity

import (
	"time"

	"humora-backend/pkg/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes registers public and protected authentication & identity endpoints.
func RegisterRoutes(router fiber.Router, handler *Handler) {
	authGroup := router.Group("/auth")

	// Per-IP limits on unauthenticated endpoints to slow credential stuffing and OTP guessing.
	strict := middleware.RateLimiter(10, time.Minute)
	moderate := middleware.RateLimiter(60, time.Minute)

	// Public Routes
	authGroup.Post("/register", strict, handler.Register)
	// Login is looser than OTP/registration because an office NAT can put many employees behind one IP.
	authGroup.Post("/login", middleware.RateLimiter(30, time.Minute), handler.Login)
	authGroup.Post("/refresh", moderate, handler.RefreshToken)
	authGroup.Post("/forgot-password", strict, handler.ForgotPassword)
	authGroup.Post("/reset-password", strict, handler.ResetPassword)

	// Social Login & Provider Discovery (Public)
	authGroup.Get("/providers", handler.GetAuthProviders)
	authGroup.Get("/oauth/:provider", moderate, handler.InitiateOAuth)
	authGroup.Get("/oauth/:provider/callback", moderate, handler.OAuthCallback)

	// WhatsApp-Style QR Login (Public Challenge Initiation & Status Poll)
	authGroup.Post("/qr/initiate", moderate, handler.InitiateQR)
	// The web login page polls status every few seconds while the QR is shown.
	authGroup.Get("/qr/status", middleware.RateLimiter(120, time.Minute), handler.GetQRStatus)

	// Protected Routes (Require Valid Session Token)
	protected := authGroup.Group("/", middleware.AuthMiddleware())
	protected.Get("/me", handler.GetProfile)
	protected.Put("/presence", handler.UpdatePresence)
	protected.Post("/device-key", handler.RegisterDeviceKey)

	// QR Login Confirmation (Authorized by mobile device)
	protected.Post("/qr/confirm", handler.ConfirmQR)
}
