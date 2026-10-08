package middleware

import (
	"fmt"
	"humora-backend/configs"
	"humora-backend/pkg/response"
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// RateLimiter creates a fixed-window rate limiter keyed by route and client IP.
// It uses Redis when available so limits are shared across instances, and falls
// back to a per-process in-memory window so auth endpoints are never left unprotected.
func RateLimiter(maxRequests int, window time.Duration) fiber.Handler {
	local := newMemoryWindow(window)

	return func(c *fiber.Ctx) error {
		key := fmt.Sprintf("ratelimit:%s:%s", c.Route().Path, c.IP())

		var count int64
		if configs.RedisClient != nil {
			ctx := c.UserContext()
			n, err := configs.RedisClient.Incr(ctx, key).Result()
			if err == nil {
				if n == 1 {
					configs.RedisClient.Expire(ctx, key, window)
				}
				count = n
			} else {
				count = local.incr(key)
			}
		} else {
			count = local.incr(key)
		}

		if count > int64(maxRequests) {
			c.Set(fiber.HeaderRetryAfter, strconv.Itoa(int(window.Seconds())))
			return response.Error(c, fiber.StatusTooManyRequests, "Too many requests. Please slow down.")
		}

		return c.Next()
	}
}

// memoryWindow is a fixed-window counter used when Redis is unavailable.
type memoryWindow struct {
	mu      sync.Mutex
	window  time.Duration
	counts  map[string]int64
	resetAt time.Time
}

func newMemoryWindow(window time.Duration) *memoryWindow {
	return &memoryWindow{window: window, counts: make(map[string]int64), resetAt: time.Now().Add(window)}
}

func (m *memoryWindow) incr(key string) int64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	if now := time.Now(); now.After(m.resetAt) {
		m.counts = make(map[string]int64)
		m.resetAt = now.Add(m.window)
	}
	m.counts[key]++
	return m.counts[key]
}
