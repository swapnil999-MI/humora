package identity

import (
	"errors"

	"humora-backend/pkg/response"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
	authExt AuthExtService
}

func NewHandler(service Service, authExt AuthExtService) *Handler {
	return &Handler{service: service, authExt: authExt}
}

// Register handles organization onboarding and primary admin account creation.
func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON request payload")
	}

	res, err := h.service.Register(c.UserContext(), &req)
	if errors.Is(err, ErrSignupClosed) {
		return response.Error(c, fiber.StatusForbidden, err.Error())
	}
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusCreated, "Organization registered successfully", res)
}

// Login handles user authentication and JWT issuing.
func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON request payload")
	}

	res, err := h.service.Login(c.UserContext(), &req)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Login successful", res)
}

// RefreshToken exchanges a valid refresh token for a new access token.
func (h *Handler) RefreshToken(c *fiber.Ctx) error {
	var req RefreshTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON request payload")
	}

	res, err := h.service.RefreshToken(c.UserContext(), req.RefreshToken)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Token refreshed successfully", res)
}

// GetProfile returns the authenticated user's profile and active permissions.
func (h *Handler) GetProfile(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return response.Error(c, fiber.StatusUnauthorized, "Unauthorized session")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid user ID")
	}

	profile, err := h.service.GetProfile(c.UserContext(), userID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "User profile retrieved", profile)
}

// UpdatePresence updates the user's presence badge (e.g. 'in_office_active', 'offline', 'on_leave').
func (h *Handler) UpdatePresence(c *fiber.Ctx) error {
	userIDStr, _ := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid user ID")
	}

	var body struct {
		Presence string `json:"presence"`
	}
	if err := c.BodyParser(&body); err != nil || body.Presence == "" {
		return response.Error(c, fiber.StatusBadRequest, "Presence status is required")
	}

	if err := h.service.UpdatePresence(c.UserContext(), userID, body.Presence); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Presence status updated", fiber.Map{
		"presence": body.Presence,
	})
}

// ForgotPassword initiates an OTP-based password recovery workflow.
func (h *Handler) ForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON request payload")
	}

	if err := h.service.RequestPasswordReset(c.UserContext(), &req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "If an account exists for this email, a verification code has been sent to it", nil)
}

// ResetPassword verifies the OTP code and sets a new password.
func (h *Handler) ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON request payload")
	}

	if err := h.service.ResetPassword(c.UserContext(), &req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Password has been reset successfully. You may now log in.", nil)
}

// GetAuthProviders returns which OAuth providers and auth methods are available.
func (h *Handler) GetAuthProviders(c *fiber.Ctx) error {
	providers := h.authExt.GetEnabledProviders()
	providers.Signup = h.service.SignupOpen(c.UserContext())
	return response.TypedSuccess(c, fiber.StatusOK, "Auth providers retrieved", providers)
}

// InitiateOAuth redirects the client to the chosen social identity provider.
func (h *Handler) InitiateOAuth(c *fiber.Ctx) error {
	provider := c.Params("provider")
	clientType := c.Query("client", "web")

	redirectURL, err := h.authExt.InitiateOAuth(provider, clientType, c.Query("challenge"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return c.Redirect(redirectURL, fiber.StatusTemporaryRedirect)
}

// OAuthCallback handles the redirect back from Google, GitHub, or Microsoft.
func (h *Handler) OAuthCallback(c *fiber.Ctx) error {
	provider := c.Params("provider")
	code := c.Query("code")
	state := c.Query("state")

	if code == "" || state == "" {
		return response.Error(c, fiber.StatusBadRequest, "Missing code or state parameters from identity provider")
	}

	destinationURL, err := h.authExt.HandleOAuthCallback(c.UserContext(), provider, code, state)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, err.Error())
	}

	return c.Redirect(destinationURL, fiber.StatusTemporaryRedirect)
}

// InitiateQR creates a temporary QR login session challenge.
func (h *Handler) InitiateQR(c *fiber.Ctx) error {
	res, err := h.authExt.InitiateQRLogin(c.UserContext(), c.IP(), truncate(c.Get(fiber.HeaderUserAgent), 200))
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "Failed to create QR login session")
	}
	return response.TypedSuccess(c, fiber.StatusCreated, "QR login challenge initiated", res)
}

// GetQRStatus checks the authorization state of an active QR session.
func (h *Handler) GetQRStatus(c *fiber.Ctx) error {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		return response.Error(c, fiber.StatusBadRequest, "session_id parameter is required")
	}

	res, err := h.authExt.GetQRStatus(c.UserContext(), sessionID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	return response.TypedSuccess(c, fiber.StatusOK, "QR login status", res)
}

// ConfirmQR is called by an authenticated mobile app to authorize the Web browser session.
func (h *Handler) ConfirmQR(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return response.Error(c, fiber.StatusUnauthorized, "Unauthorized session")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid user ID")
	}

	var req QRConfirmRequest
	if err := c.BodyParser(&req); err != nil || req.SessionID == "" || req.Nonce == "" {
		return response.Error(c, fiber.StatusBadRequest, "session_id and nonce are required")
	}

	if err := h.authExt.ConfirmQRLogin(c.UserContext(), req.SessionID, req.Nonce, userID); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Web session authorized successfully", nil)
}

// GetQRInfo shows the phone which browser a scanned QR code would sign in, before approving.
func (h *Handler) GetQRInfo(c *fiber.Ctx) error {
	info, err := h.authExt.GetQRInfo(c.Query("session_id"), c.Query("nonce"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.TypedSuccess(c, fiber.StatusOK, "QR login request", info)
}

// ExchangeOAuthCode collects the tokens of a finished social login.
func (h *Handler) ExchangeOAuthCode(c *fiber.Ctx) error {
	var req OAuthExchangeRequest
	if err := c.BodyParser(&req); err != nil || req.Code == "" || req.Verifier == "" {
		return response.Error(c, fiber.StatusBadRequest, "code and verifier are required")
	}
	res, err := h.authExt.ExchangeOAuthCode(req.Code, req.Verifier)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, err.Error())
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Signed in", res)
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
