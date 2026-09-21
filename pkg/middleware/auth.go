package middleware

import (
	"fmt"
	"humora-backend/configs"
	"humora-backend/pkg/response"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// UserClaims defines JWT token payload claims for Humora users.
type UserClaims struct {
	UserID   string   `json:"user_id"`
	TenantID string   `json:"tenant_id"`
	Email    string   `json:"email"`
	Role     string   `json:"role"`
	Perms    []string `json:"perms"`
	jwt.RegisteredClaims
}

// AuthMiddleware validates JWT Bearer tokens and injects claims into context.
func AuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			// Fallback to cookie if present
			authHeader = c.Cookies("access_token")
			if authHeader != "" {
				authHeader = "Bearer " + authHeader
			}
		}

		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return response.Error(c, fiber.StatusUnauthorized, "Missing or invalid authorization token")
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(configs.AppConfig.Server.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			return response.Error(c, fiber.StatusUnauthorized, "Invalid or expired session token")
		}

		claims, ok := token.Claims.(*UserClaims)
		if !ok {
			return response.Error(c, fiber.StatusUnauthorized, "Malformed token claims")
		}

		// Inject claims into Fiber Locals
		c.Locals("user_id", claims.UserID)
		c.Locals("tenant_id", claims.TenantID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)
		c.Locals("perms", claims.Perms)

		return c.Next()
	}
}

// RequirePermission checks if the authenticated user has a specific permission.
func RequirePermission(requiredPerm string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		permsVal := c.Locals("perms")
		if permsVal == nil {
			return response.Error(c, fiber.StatusForbidden, "Forbidden: insufficient permissions")
		}

		perms, ok := permsVal.([]string)
		if !ok {
			return response.Error(c, fiber.StatusForbidden, "Forbidden: invalid permission format")
		}

		// Admin / superuser bypass
		role, _ := c.Locals("role").(string)
		if role == "superadmin" || role == "admin" {
			return c.Next()
		}

		for _, p := range perms {
			if p == requiredPerm || p == "*" {
				return c.Next()
			}
		}

		return response.Error(c, fiber.StatusForbidden, fmt.Sprintf("Forbidden: missing permission %q", requiredPerm))
	}
}
