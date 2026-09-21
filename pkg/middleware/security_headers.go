package middleware

import "github.com/gofiber/fiber/v2"

// SecurityHeaders returns a middleware that sets secure HTTP response headers.
func SecurityHeaders() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Enforce HTTPS
		c.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		// Prevent Clickjacking
		c.Set("X-Frame-Options", "DENY")
		// Prevent MIME-sniffing
		c.Set("X-Content-Type-Options", "nosniff")
		// Limit Referrer leaks
		c.Set("Referrer-Policy", "no-referrer")
		// Mitigation for XSS & frame injection
		c.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox")
		// Permissions Policy
		c.Set("Permissions-Policy", "geolocation=(self), camera=(), microphone=()")

		return c.Next()
	}
}
