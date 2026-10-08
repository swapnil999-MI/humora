package health

import (
	"context"
	"time"

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
//
//   - /livez  : process is up (liveness probe; never touches dependencies)
//   - /readyz : database is reachable (readiness probe; 503 takes the instance out of rotation)
//   - /health : human-readable dependency summary
func RegisterRoutes(app *fiber.App) {
	app.Get("/livez", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	app.Get("/readyz", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.UserContext(), 2*time.Second)
		defer cancel()
		if configs.DB == nil || configs.DB.PingContext(ctx) != nil {
			return c.Status(fiber.StatusServiceUnavailable).SendString("database unavailable")
		}
		return c.SendStatus(fiber.StatusOK)
	})

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
