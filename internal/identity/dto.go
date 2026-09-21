package identity

import "strings"

// RegisterRequest holds tenant and admin user creation parameters.
type RegisterRequest struct {
	OrganizationName string `json:"organization_name"`
	Slug             string `json:"slug"`
	Domain           string `json:"domain,omitempty"`
	AdminEmail       string `json:"admin_email"`
	AdminPassword    string `json:"admin_password"`
	FirstName        string `json:"first_name"`
	LastName         string `json:"last_name"`
}

func (r *RegisterRequest) Validate() string {
	if strings.TrimSpace(r.OrganizationName) == "" {
		return "organization_name is required"
	}
	if strings.TrimSpace(r.Slug) == "" {
		return "slug is required"
	}
	if strings.TrimSpace(r.AdminEmail) == "" || !strings.Contains(r.AdminEmail, "@") {
		return "valid admin_email is required"
	}
	if len(r.AdminPassword) < 8 {
		return "admin_password must be at least 8 characters"
	}
	if strings.TrimSpace(r.FirstName) == "" {
		return "first_name is required"
	}
	return ""
}

// LoginRequest defines credentials for authentication.
type LoginRequest struct {
	TenantSlug string `json:"tenant_slug"` // optional if user domain is known or single-tenant login
	Email      string `json:"email"`
	Password   string `json:"password"`
}

func (r *LoginRequest) Validate() string {
	if strings.TrimSpace(r.Email) == "" || !strings.Contains(r.Email, "@") {
		return "valid email is required"
	}
	if strings.TrimSpace(r.Password) == "" {
		return "password is required"
	}
	return ""
}

// RefreshTokenRequest holds the refresh token for issuing a new access token.
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// UserSummary represents public user metadata.
type UserSummary struct {
	ID             string   `json:"id"`
	TenantID       string   `json:"tenant_id"`
	TenantName     string   `json:"tenant_name"`
	TenantSlug     string   `json:"tenant_slug"`
	Email          string   `json:"email"`
	Status         string   `json:"status"`
	PresenceStatus string   `json:"presence_status"`
	Roles          []string `json:"roles"`
	Permissions    []string `json:"permissions"`
}

// AuthResponse holds the JWT tokens and user details.
type AuthResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	TokenType    string      `json:"token_type"`
	ExpiresIn    int64       `json:"expires_in"` // seconds
	User         UserSummary `json:"user"`
}
