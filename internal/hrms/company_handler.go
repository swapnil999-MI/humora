package hrms

import (
	"humora-backend/pkg/response"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type CompanyHandler struct {
	service CompanyService
}

func NewCompanyHandler(service CompanyService) *CompanyHandler {
	return &CompanyHandler{service: service}
}

// GetCompanyProfile returns statutory, tax, address, and branding information.
func (h *CompanyHandler) GetCompanyProfile(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	profile, err := h.service.GetCompanyProfile(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Company profile retrieved", profile)
}

// UpdateCompanyProfile saves statutory, tax, address, and branding information.
func (h *CompanyHandler) UpdateCompanyProfile(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req CompanyProfile
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	updated, err := h.service.UpdateCompanyProfile(c.UserContext(), tenantID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "Company profile updated successfully", updated)
}

// GetSMTPConfig returns the current SMTP gateway configuration without exposing passwords.
func (h *CompanyHandler) GetSMTPConfig(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	cfg, err := h.service.GetSMTPConfig(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "SMTP configuration retrieved", cfg)
}

// SaveSMTPConfig updates or registers corporate SMTP settings with AES encryption.
func (h *CompanyHandler) SaveSMTPConfig(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req SaveSMTPConfigRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}

	saved, err := h.service.SaveSMTPConfig(c.UserContext(), tenantID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.TypedSuccess(c, fiber.StatusOK, "SMTP configuration saved securely", saved)
}

// TestSMTPConfig initiates a live test message through the configured SMTP gateway.
func (h *CompanyHandler) TestSMTPConfig(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req TestSMTPRequest
	_ = c.BodyParser(&req)

	if strings.TrimSpace(req.RecipientEmail) == "" {
		req.RecipientEmail = strings.TrimSpace(c.Query("recipient_email"))
	}
	if strings.TrimSpace(req.RecipientEmail) == "" {
		req.RecipientEmail = strings.TrimSpace(c.Query("recipient"))
	}
	if strings.TrimSpace(req.RecipientEmail) == "" {
		if emailVal, ok := c.Locals("email").(string); ok && emailVal != "" {
			req.RecipientEmail = emailVal
		}
	}
	if strings.TrimSpace(req.Host) == "" {
		req.Host = strings.TrimSpace(c.Query("host"))
	}

	if err := h.service.TestSMTPConfig(c.UserContext(), tenantID, &req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Test email delivered successfully", nil)
}
