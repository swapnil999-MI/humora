package middleware

import (
	"fmt"
	"humora-backend/pkg/alert"
	"humora-backend/pkg/logger"
	"humora-backend/pkg/response"
	"runtime/debug"

	"github.com/gofiber/fiber/v2"
)

// RecoverMiddleware intercepts and recovers from any runtime panics during HTTP request processing.
func RecoverMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) (err error) {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				errMsg := fmt.Sprintf("%v", r)

				logger.Error(fmt.Sprintf("CRITICAL PANIC RECOVERED: %s | Route: %s %s | IP: %s\nStack Trace:\n%s",
					errMsg, c.Method(), c.Path(), c.IP(), stack))

				// Send critical alert asynchronously
				alert.SendCriticalAlert(
					fmt.Sprintf("HTTP Server Panic on %s %s", c.Method(), c.Path()),
					fmt.Errorf("Panic Error: %s\nClient IP: %s\n\nStack Trace:\n%s", errMsg, c.IP(), stack),
				)

				err = response.Error(c, fiber.StatusInternalServerError, "Internal server error occurred")
			}
		}()
		return c.Next()
	}
}
