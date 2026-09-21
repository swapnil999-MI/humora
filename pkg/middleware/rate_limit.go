package middleware

import (
	"fmt"
	"humora-backend/configs"
	"humora-backend/pkg/response"
	"time"

	"github.com/gofiber/fiber/v2"
)

// RateLimiter creates an in-memory or Redis-backed sliding window rate limiter.
func RateLimiter(maxRequests int, window time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if configs.RedisClient == nil {
			return c.Next() // Bypass if Redis not initialized
		}

		ip := c.IP()
		key := fmt.Sprintf("ratelimit:%s:%s", c.Path(), ip)

		ctx := c.UserContext()
		count, err := configs.RedisClient.Incr(ctx, key).Result()
		if err != nil {
			return c.Next()
		}

		if count == 1 {
			configs.RedisClient.Expire(ctx, key, window)
		}

		if count > int64(maxRequests) {
			return response.Error(c, fiber.StatusTooManyRequests, "Too many requests. Please slow down.")
		}

		return c.Next()
	}
}
