package pulse

import (
	"errors"
	"fmt"
	"humora-backend/pkg/response"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func parseTenantAndUser(c *fiber.Ctx) (uuid.UUID, uuid.UUID, error) {
	tenantIDRaw, _ := c.Locals("tenant_id").(string)
	tenantID, err := uuid.Parse(tenantIDRaw)
	if err != nil {
		return uuid.Nil, uuid.Nil, fiber.ErrUnauthorized
	}
	userIDRaw, _ := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDRaw)
	if err != nil {
		return uuid.Nil, uuid.Nil, fiber.ErrUnauthorized
	}
	return tenantID, userID, nil
}

// fail maps service errors onto HTTP statuses.
func fail(c *fiber.Ctx, err error) error {
	var inv *InvalidError
	switch {
	case errors.As(err, &inv):
		return response.Error(c, fiber.StatusBadRequest, inv.Error())
	case errors.Is(err, ErrNotFound):
		return response.Error(c, fiber.StatusNotFound, "Not found")
	case errors.Is(err, ErrForbidden):
		return response.Error(c, fiber.StatusForbidden, "Forbidden: insufficient permissions")
	case errors.Is(err, ErrConflict):
		return response.Error(c, fiber.StatusConflict, "Conflict: the conversation's epoch has moved on")
	default:
		return response.Error(c, fiber.StatusInternalServerError, fmt.Sprintf("Pulse request failed {{%s}}", err.Error()))
	}
}

// ───────────────────────────── Devices ─────────────────────────────

// RegisterDevice enrolls the calling client as an encryption device.
func (h *Handler) RegisterDevice(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	var req RegisterDeviceRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	d, err := h.service.RegisterDevice(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusCreated, "Device registered", d)
}

// ListDevices returns the caller's active devices.
func (h *Handler) ListDevices(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	devices, err := h.service.ListDevices(c.UserContext(), tenantID, userID)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Devices retrieved", devices)
}

// LookupDevices returns the public device directory (ids and identity keys)
// for users in the caller's tenant, so group members can tell which devices
// a conversation's keys should be shared with.
func (h *Handler) LookupDevices(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	var req DeviceLookupRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	devices, err := h.service.LookupDevices(c.UserContext(), tenantID, req.UserIDs)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Devices retrieved", devices)
}

// RevokeDevice retires one of the caller's devices and disconnects it.
func (h *Handler) RevokeDevice(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	deviceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid device ID")
	}
	if err := h.service.RevokeDevice(c.UserContext(), tenantID, userID, deviceID); err != nil {
		return fail(c, err)
	}
	return response.Success(c, fiber.StatusOK, "Device revoked", nil)
}

// SetPushToken registers where to wake this device when it is offline.
// PUT /pulse/devices/:id/push-token {"token": "..."}; an empty token unregisters.
func (h *Handler) SetPushToken(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	deviceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid device ID")
	}
	var req struct {
		Token string `json:"token"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	if err := h.service.SetPushToken(c.UserContext(), tenantID, userID, deviceID, req.Token); err != nil {
		return fail(c, err)
	}
	return response.Success(c, fiber.StatusOK, "Push token saved", nil)
}

// AddKeyPackages tops up a device's one-time key packages.
func (h *Handler) AddKeyPackages(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	deviceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid device ID")
	}
	var req AddKeyPackagesRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	remaining, err := h.service.AddKeyPackages(c.UserContext(), tenantID, userID, deviceID, req.KeyPackages)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Key packages stored", KeyPackageCountResponse{Remaining: remaining})
}

// CountKeyPackages tells a device how many unused key packages it has left.
func (h *Handler) CountKeyPackages(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	deviceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid device ID")
	}
	remaining, err := h.service.CountKeyPackages(c.UserContext(), tenantID, userID, deviceID)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Key packages counted", KeyPackageCountResponse{Remaining: remaining})
}

// ClaimKeyPackages hands out one key package per device of the target user.
func (h *Handler) ClaimKeyPackages(c *fiber.Ctx) error {
	tenantID, _, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	targetID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid user ID")
	}
	claimed, err := h.service.ClaimKeyPackages(c.UserContext(), tenantID, targetID)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Key packages claimed", claimed)
}

// ───────────────────────────── Gateway ─────────────────────────────

// IssueTicket exchanges the session for a single-use WebSocket ticket.
func (h *Handler) IssueTicket(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	var req TicketRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	deviceID, err := uuid.Parse(req.DeviceID)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid device ID")
	}
	ticket, err := h.service.IssueTicket(c.UserContext(), tenantID, userID, deviceID)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Ticket issued", TicketResponse{Ticket: ticket, ExpiresIn: int(ticketTTL.Seconds())})
}

// UpgradeGate admits a WebSocket upgrade only with a valid, unused ticket.
func (h *Handler) UpgradeGate(c *fiber.Ctx) error {
	if !websocket.IsWebSocketUpgrade(c) {
		return response.Error(c, fiber.StatusUpgradeRequired, "WebSocket upgrade required")
	}
	sess, ok := h.service.RedeemTicket(c.UserContext(), c.Query("ticket"))
	if !ok {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid or expired ticket")
	}
	c.Locals(sessionLocalKey, sess)
	return c.Next()
}

// ───────────────────────────── Conversations ─────────────────────────────

// CreateConversation starts a DM, group, or channel. Creating a DM that
// already exists returns the existing one.
func (h *Handler) CreateConversation(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	var req CreateConversationRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	conv, created, err := h.service.CreateConversation(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return fail(c, err)
	}
	if !created {
		return response.TypedSuccess(c, fiber.StatusOK, "Conversation already exists", conv)
	}
	return response.TypedSuccess(c, fiber.StatusCreated, "Conversation created", conv)
}

// ListConversations returns the caller's conversations with member watermarks.
func (h *Handler) ListConversations(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	convs, err := h.service.ListConversations(c.UserContext(), tenantID, userID)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Conversations retrieved", convs)
}

// GetConversation returns one conversation the caller belongs to.
func (h *Handler) GetConversation(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	convID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid conversation ID")
	}
	conv, err := h.service.GetConversation(c.UserContext(), tenantID, userID, convID)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Conversation retrieved", conv)
}

// PutGroupInfo publishes the encryption group's public state for the current epoch.
func (h *Handler) PutGroupInfo(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	convID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid conversation ID")
	}
	var req PutGroupInfoRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	if err := h.service.PutGroupInfo(c.UserContext(), tenantID, userID, convID, &req); err != nil {
		return fail(c, err)
	}
	return response.Success(c, fiber.StatusOK, "Group info stored", nil)
}

// GetGroupInfo returns the encryption group's public state for the current epoch.
func (h *Handler) GetGroupInfo(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	convID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid conversation ID")
	}
	info, err := h.service.GetGroupInfo(c.UserContext(), tenantID, userID, convID)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Group info retrieved", info)
}

// AddMembers adds users to a group or channel.
func (h *Handler) AddMembers(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	convID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid conversation ID")
	}
	var req AddMembersRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	conv, err := h.service.AddMembers(c.UserContext(), tenantID, userID, convID, req.UserIDs)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Members added", conv)
}

// RemoveMember removes a member, or lets the caller leave.
func (h *Handler) RemoveMember(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	convID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid conversation ID")
	}
	targetID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid user ID")
	}
	if err := h.service.RemoveMember(c.UserContext(), tenantID, userID, convID, targetID); err != nil {
		return fail(c, err)
	}
	return response.Success(c, fiber.StatusOK, "Member removed", nil)
}

// ───────────────────────────── Media ─────────────────────────────

// MediaUpload returns a one-object, size-capped upload form for an encrypted attachment.
func (h *Handler) MediaUpload(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	var req MediaUploadRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	res, err := h.service.MediaUpload(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Upload ready", res)
}

// MediaDownload returns a short-lived link to an encrypted attachment of a conversation the caller belongs to.
func (h *Handler) MediaDownload(c *fiber.Ctx) error {
	tenantID, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	var req MediaDownloadRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	res, err := h.service.MediaDownload(c.UserContext(), tenantID, userID, &req)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Download ready", res)
}

// ───────────────────────────── Key backups ─────────────────────────────

// PutKeyBackups stores message keys encrypted under the caller's recovery key.
func (h *Handler) PutKeyBackups(c *fiber.Ctx) error {
	_, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	var req PutKeyBackupsRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "Invalid JSON payload")
	}
	if err := h.service.PutKeyBackups(c.UserContext(), userID, req.Items); err != nil {
		return fail(c, err)
	}
	return response.Success(c, fiber.StatusOK, "Key backups stored", nil)
}

// ListKeyBackups returns the caller's key backups, optionally for one conversation.
func (h *Handler) ListKeyBackups(c *fiber.Ctx) error {
	_, userID, err := parseTenantAndUser(c)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "Invalid session context")
	}
	var convID *uuid.UUID
	if raw := c.Query("conversation_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, "Invalid conversation ID")
		}
		convID = &id
	}
	items, err := h.service.ListKeyBackups(c.UserContext(), userID, convID)
	if err != nil {
		return fail(c, err)
	}
	return response.TypedSuccess(c, fiber.StatusOK, "Key backups retrieved", items)
}
