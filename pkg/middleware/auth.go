package middleware

import (
	"fmt"
	"humora-backend/configs"
	"humora-backend/pkg/response"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Token audiences separate short-lived access tokens from long-lived refresh tokens,
// so a refresh token can never be presented as an access token (and vice versa).
const (
	TokenIssuer          = "humora-auth"
	AccessTokenAudience  = "humora-access"
	RefreshTokenAudience = "humora-refresh"
)

// ParseToken verifies an HS256 token signed by Humora and issued for the given audience.
func ParseToken(tokenString, audience string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(configs.AppConfig.Server.JWTSecret), nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(TokenIssuer),
		jwt.WithAudience(audience),
		jwt.WithExpirationRequired(),
	)
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(*UserClaims)
	if !ok {
		return nil, fmt.Errorf("malformed token claims")
	}
	return claims, nil
}

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

		claims, err := ParseToken(tokenString, AccessTokenAudience)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Invalid or expired session token")
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

// RequireRole checks if the authenticated user has at least one of the specified roles.
func RequireRole(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		roleVal := c.Locals("role")
		if roleVal == nil {
			return response.Error(c, fiber.StatusForbidden, "Forbidden: role not defined")
		}

		userRole, _ := roleVal.(string)
		if userRole == "superadmin" {
			return c.Next()
		}

		for _, allowed := range allowedRoles {
			if strings.EqualFold(userRole, allowed) {
				return c.Next()
			}
		}

		return response.Error(c, fiber.StatusForbidden, fmt.Sprintf("Forbidden: action requires one of the following roles: %v", allowedRoles))
	}
}
