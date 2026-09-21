package middleware

import (
	"fmt"
	"humora-backend/pkg/alert"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Logger returns a highly optimized middleware that logs incoming HTTP requests using slog.
func Logger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		chainErr := c.Next()

		status := c.Response().StatusCode()
		if chainErr != nil {
			if e, ok := chainErr.(*fiber.Error); ok {
				status = e.Code
			} else {
				status = fiber.StatusInternalServerError
			}
		}

		latency := time.Since(start)
		method := c.Method()
		path := c.Path()
		ip := c.IP()
		userAgent := c.Get(fiber.HeaderUserAgent)

		attrs := []slog.Attr{
			slog.String("method", method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("latency", latency),
			slog.String("ip", ip),
			slog.String("user_agent", userAgent),
		}

		if tenantID := c.Locals("tenant_id"); tenantID != nil {
			attrs = append(attrs, slog.Any("tenant_id", tenantID))
		}
		if userID := c.Locals("user_id"); userID != nil {
			attrs = append(attrs, slog.Any("user_id", userID))
		}

		var errVal string
		if chainErr != nil {
			errVal = chainErr.Error()
		} else if errMsg := c.Locals("error_message"); errMsg != nil {
			errVal = fmt.Sprintf("%v", errMsg)
		}

		if errVal != "" {
			attrs = append(attrs, slog.String("error", errVal))
		}

		if status >= 500 {
			slog.LogAttrs(c.UserContext(), slog.LevelError, "Request Failed (Server Error)", attrs...)
			alert.SendServerError(c, errVal, latency)
		} else if status >= 400 {
			slog.LogAttrs(c.UserContext(), slog.LevelWarn, "Request Failed (Client Error)", attrs...)
		} else {
			slog.LogAttrs(c.UserContext(), slog.LevelInfo, "Request Succeeded", attrs...)
		}

		return chainErr
	}
}
