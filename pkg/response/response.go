package response

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// GenericSuccessResponse defines the standard payload structure for successful requests with compile-time type safety.
type GenericSuccessResponse[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

// SuccessResponse defines the standard payload structure for successful requests with dynamic data.
type SuccessResponse = GenericSuccessResponse[any]

// ErrorResponse defines the standard payload structure for failed requests.
type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// Success helper standardizes success JSON response returning, accepting any data payload (including nil).
func Success(c *fiber.Ctx, statusCode int, message string, data any) error {
	return c.Status(statusCode).JSON(SuccessResponse{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// TypedSuccess helper standardizes success JSON response returning with explicit Go 1.27 generic type safety.
func TypedSuccess[T any](c *fiber.Ctx, statusCode int, message string, data T) error {
	return c.Status(statusCode).JSON(GenericSuccessResponse[T]{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// Error helper standardizes error JSON response returning.
func Error(c *fiber.Ctx, statusCode int, message string) error {
	clientMessage := strings.TrimSpace(message)
	var extractedDetails string

	// 1. Check for explicit internal details delimiters: {{ ... }}
	startIdx := strings.Index(message, "{{")
	endIdx := strings.LastIndex(message, "}}")

	if startIdx != -1 && endIdx != -1 && endIdx > startIdx+1 {
		clientMessage = strings.TrimSpace(message[:startIdx])
		extractedDetails = strings.TrimSpace(message[startIdx+2 : endIdx])
	} else if statusCode >= 500 {
		// 2. Defense-in-depth shield: Auto-sanitize unshielded 500 errors to avoid leaking database/system internals
		lower := strings.ToLower(message)
		sensitiveIndicators := []string{
			"pq:", "sql:", "dial tcp", "connection refused", "driver: bad connection",
			"deadlock detected", "cannot assign requested address", "syntax error at or near",
			"panic:", "duplicate key value violates unique constraint",
		}

		containsSensitive := false
		for _, ind := range sensitiveIndicators {
			if strings.Contains(lower, ind) {
				containsSensitive = true
				break
			}
		}

		if containsSensitive {
			extractedDetails = message
			clientMessage = "Internal server error occurred"

			// If format is "user message: raw system error", check if the prefix before ':' is a clean custom message
			if colonIdx := strings.Index(message, ":"); colonIdx > 0 {
				prefix := strings.TrimSpace(message[:colonIdx])
				prefixLower := strings.ToLower(prefix)

				// Prefix must not contain any sensitive system terms
				prefixIsClean := len(prefix) > 3
				for _, ind := range sensitiveIndicators {
					cleanInd := strings.TrimSuffix(ind, ":")
					if strings.Contains(prefixLower, cleanInd) {
						prefixIsClean = false
						break
					}
				}

				if prefixIsClean {
					clientMessage = prefix
				}
			}
		}
	}

	// Fallback if clientMessage ended up empty
	if clientMessage == "" {
		if statusCode >= 500 {
			clientMessage = "Internal server error occurred"
		} else {
			clientMessage = "Invalid request"
		}
	}

	// Store clean data in context locals for structured request logging & Telegram alerts
	c.Locals("error_message", clientMessage)
	if extractedDetails != "" {
		c.Locals("error_details", extractedDetails)
	}

	return c.Status(statusCode).JSON(ErrorResponse{
		Success: false,
		Message: clientMessage,
	})
}
