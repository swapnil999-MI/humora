package identity

import (
	"humora-backend/pkg/response"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// Register handles organization onboarding and primary admin account creation.
func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON request payload")
	}

	res, err := h.service.Register(c.UserContext(), &req)
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

// RegisterDeviceKey saves the client Ed25519 public key for verifying offline attendance punches.
func (h *Handler) RegisterDeviceKey(c *fiber.Ctx) error {
	userIDStr, _ := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid user ID")
	}

	var body struct {
		PublicKey string `json:"public_key"`
	}
	if err := c.BodyParser(&body); err != nil || body.PublicKey == "" {
		return response.Error(c, fiber.StatusBadRequest, "public_key string is required")
	}

	if err := h.service.RegisterDeviceKey(c.UserContext(), userID, body.PublicKey); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Device public key registered successfully", nil)
}
