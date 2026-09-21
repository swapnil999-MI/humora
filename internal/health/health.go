package health

import (
	"humora-backend/configs"
	"humora-backend/pkg/response"

	"github.com/gofiber/fiber/v2"
)

// HealthResponse describes the health state of the service and connected dependencies.
type HealthResponse struct {
	Status   string `json:"status"`
	Version  string `json:"version"`
	Database string `json:"database"`
	Redis    string `json:"redis"`
}

// RegisterRoutes registers health check endpoints on the Fiber app.
func RegisterRoutes(app *fiber.App) {
	app.Get("/health", func(c *fiber.Ctx) error {
		dbStatus := "down"
		if configs.DB != nil {
			if err := configs.DB.Ping(); err == nil {
				dbStatus = "up"
			}
		}

		redisStatus := "down"
		if configs.RedisClient != nil {
			if err := configs.RedisClient.Ping(c.UserContext()).Err(); err == nil {
				redisStatus = "up"
			}
		}

		overall := "healthy"
		if dbStatus != "up" {
			overall = "degraded"
		}

		return response.Success(c, fiber.StatusOK, "Health check status", HealthResponse{
			Status:   overall,
			Version:  "1.0.0",
			Database: dbStatus,
			Redis:    redisStatus,
		})
	})
}
