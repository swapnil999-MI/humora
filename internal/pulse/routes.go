package pulse

import (
	"humora-backend/pkg/middleware"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes mounts the Pulse messaging endpoints under /api/v1/pulse.
func RegisterRoutes(router fiber.Router, handler *Handler, hub *Hub) {
	// Realtime gateway. Registered ahead of the JWT group because it is
	// authenticated by a single-use ticket instead. No Origin allow-list is
	// needed: the ticket can only be obtained through the CORS-protected,
	// JWT-authenticated endpoint below, and native clients send no Origin.
	router.Get("/pulse/ws", handler.UpgradeGate, websocket.New(hub.Serve, websocket.Config{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		// Payloads are ciphertext, which does not compress.
		EnableCompression: false,
	}))

	pulseGroup := router.Group("/pulse", middleware.AuthMiddleware())

	// Devices & keys
	pulseGroup.Post("/devices", handler.RegisterDevice)
	pulseGroup.Get("/devices", handler.ListDevices)
	pulseGroup.Delete("/devices/:id", handler.RevokeDevice)
	pulseGroup.Put("/devices/:id/push-token", handler.SetPushToken)
	pulseGroup.Post("/devices/:id/key-packages", handler.AddKeyPackages)
	pulseGroup.Get("/devices/:id/key-packages", handler.CountKeyPackages)
	pulseGroup.Post("/devices/lookup", handler.LookupDevices)
	pulseGroup.Post("/users/:userId/key-packages/claim", handler.ClaimKeyPackages)

	// Gateway
	pulseGroup.Post("/ws-ticket", handler.IssueTicket)

	// Conversations
	pulseGroup.Post("/conversations", handler.CreateConversation)
	pulseGroup.Get("/conversations", handler.ListConversations)
	pulseGroup.Get("/conversations/:id", handler.GetConversation)
	pulseGroup.Post("/conversations/:id/members", handler.AddMembers)
	pulseGroup.Delete("/conversations/:id/members/:userId", handler.RemoveMember)

	// Encrypted attachments
	pulseGroup.Post("/media/upload-url", handler.MediaUpload)
	pulseGroup.Post("/media/download-url", handler.MediaDownload)

	// Key backups
	pulseGroup.Put("/key-backups", handler.PutKeyBackups)
	pulseGroup.Get("/key-backups", handler.ListKeyBackups)
}
