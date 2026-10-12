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

// ForgotPasswordRequest parameters for requesting an OTP code.
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

func (r *ForgotPasswordRequest) Validate() string {
	if strings.TrimSpace(r.Email) == "" || !strings.Contains(r.Email, "@") {
		return "valid email is required"
	}
	return ""
}

// ResetPasswordRequest parameters for verifying OTP and changing password.
type ResetPasswordRequest struct {
	Email       string `json:"email"`
	OTP         string `json:"otp"`
	OTPCode     string `json:"otp_code"`
	NewPassword string `json:"new_password"`
}

func (r *ResetPasswordRequest) Validate() string {
	if strings.TrimSpace(r.Email) == "" || !strings.Contains(r.Email, "@") {
		return "valid email is required"
	}
	if r.OTP == "" && r.OTPCode != "" {
		r.OTP = r.OTPCode
	}
	if len(strings.TrimSpace(r.OTP)) < 4 {
		return "valid OTP verification code is required"
	}
	if len(r.NewPassword) < 3 {
		return "new_password must be at least 3 characters"
	}
	return ""
}

// AuthProvidersResponse lists which login methods are active
type AuthProvidersResponse struct {
	Google    bool `json:"google"`
	Github    bool `json:"github"`
	Microsoft bool `json:"microsoft"`
	QRCode    bool `json:"qr_code"`
}

// QRInitiateResponse returns session token for QR rendering
type QRInitiateResponse struct {
	SessionID string `json:"session_id"`
	QRPayload string `json:"qr_payload"`
	ExpiresIn int64  `json:"expires_in"`
}

// QRStatusResponse returns the current state of a QR login session
type QRStatusResponse struct {
	Status string        `json:"status"` // "pending", "authenticated", "expired"
	Auth   *AuthResponse `json:"auth,omitempty"`
}

// QRConfirmRequest is sent by an authenticated mobile app to approve a QR session.
// The nonce comes from the scanned QR code and proves the phone actually saw it.
type QRConfirmRequest struct {
	SessionID string `json:"session_id"`
	Nonce     string `json:"nonce"`
}

// QRInfoResponse describes the browser asking to be signed in, shown before approving.
type QRInfoResponse struct {
	RequesterIP    string `json:"requester_ip"`
	RequesterAgent string `json:"requester_agent"`
	ExpiresIn      int64  `json:"expires_in"`
}

// OAuthExchangeRequest collects a finished social login with the PKCE verifier.
type OAuthExchangeRequest struct {
	Code     string `json:"code"`
	Verifier string `json:"verifier"`
}
