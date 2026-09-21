package hrms

import (
	"humora-backend/pkg/response"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type OnboardingHandler struct {
	service OnboardingService
}

func NewOnboardingHandler(service OnboardingService) *OnboardingHandler {
	return &OnboardingHandler{service: service}
}

// GetMyProfile handles employee self-service fetch of their full profile.
// GET /api/v1/hrms/profile/me
func (h *OnboardingHandler) GetMyProfile(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	profile, err := h.service.GetMyProfile(c.UserContext(), tenantID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Employee profile retrieved", profile)
}

// UpdateMyProfile handles employee self-service updates of personal data.
// PUT /api/v1/hrms/profile/me
func (h *OnboardingHandler) UpdateMyProfile(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req UpdateMyProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid request body")
	}

	if err := h.service.UpdateMyProfile(c.UserContext(), tenantID, userID, &req); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Profile updated successfully", nil)
}

// ListOnboardingCandidates lists candidates in the onboarding pipeline for HR.
// GET /api/v1/hrms/onboarding/pipeline
func (h *OnboardingHandler) ListOnboardingCandidates(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	candidates, err := h.service.ListOnboardingCandidates(c.UserContext(), tenantID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Onboarding candidates retrieved", candidates)
}

// InviteCandidate HR invites a new hire to the candidate onboarding portal.
// POST /api/v1/hrms/onboarding/invite
func (h *OnboardingHandler) InviteCandidate(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	var req InviteCandidateRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid request body")
	}

	if req.FirstName == "" || req.LastName == "" || req.PersonalEmail == "" {
		return response.Error(c, fiber.StatusBadRequest, "First name, last name, and personal email are required")
	}

	candidate, err := h.service.InviteCandidate(c.UserContext(), tenantID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusCreated, "Candidate invitation created", candidate)
}

// GetCandidateByToken candidate self-service portal loads their onboarding flow.
// GET /api/v1/hrms/onboarding/candidate/:token
func (h *OnboardingHandler) GetCandidateByToken(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return response.Error(c, fiber.StatusBadRequest, "Missing onboarding token")
	}

	view, err := h.service.GetCandidateByToken(c.UserContext(), token)
	if err != nil {
		return response.Error(c, fiber.StatusNotFound, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Onboarding dossier loaded", view)
}

// SaveCandidateDossier candidate submits onboarding stages or final submission.
// PUT /api/v1/hrms/onboarding/candidate/:token
func (h *OnboardingHandler) SaveCandidateDossier(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return response.Error(c, fiber.StatusBadRequest, "Missing onboarding token")
	}

	var req SaveDossierRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid request body")
	}

	if err := h.service.SaveCandidateDossier(c.UserContext(), token, &req); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Onboarding dossier saved", nil)
}

// ApproveAndConvertCandidate HR 1-click converts an onboarded candidate to an active employee.
// POST /api/v1/hrms/onboarding/candidates/:id/convert
func (h *OnboardingHandler) ApproveAndConvertCandidate(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	candidateID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid candidate ID")
	}

	var req ConvertCandidateRequest
	_ = c.BodyParser(&req)

	emp, err := h.service.ApproveAndConvertCandidate(c.UserContext(), tenantID, candidateID, &req)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Candidate successfully approved and converted to active employee", emp)
}

// UploadProfileMedia handles avatar and banner image uploads for the logged-in employee.
// POST /api/v1/hrms/profile/upload
func (h *OnboardingHandler) UploadProfileMedia(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}

	mediaType := c.FormValue("media_type", "avatar")
	if mediaType != "banner" {
		mediaType = "avatar"
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "No file uploaded or invalid form field 'file'")
	}

	fileURL, err := h.service.UploadProfileMedia(c.UserContext(), tenantID, userID, mediaType, fileHeader)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Media uploaded successfully", fiber.Map{
		"url":        fileURL,
		"media_type": mediaType,
	})
}

