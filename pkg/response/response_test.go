package response

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestResponseError_ParsingAndShielding(t *testing.T) {
	tests := []struct {
		name                 string
		statusCode           int
		inputMsg             string
		expectedClientMsg    string
		expectedErrorDetails string
	}{
		{
			name:                 "Standard 400 validation error without details",
			statusCode:           fiber.StatusBadRequest,
			inputMsg:             "invalid email or password",
			expectedClientMsg:    "invalid email or password",
			expectedErrorDetails: "",
		},
		{
			name:                 "Error with explicit {{details}} delimiter (subslice bug fix)",
			statusCode:           fiber.StatusBadRequest,
			inputMsg:             "Invalid input {{key 'Email' is required}}",
			expectedClientMsg:    "Invalid input",
			expectedErrorDetails: "key 'Email' is required",
		},
		{
			name:                 "500 error with {{details}} delimiter",
			statusCode:           fiber.StatusInternalServerError,
			inputMsg:             "failed to save OTP {{dial tcp: connection refused}}",
			expectedClientMsg:    "failed to save OTP",
			expectedErrorDetails: "dial tcp: connection refused",
		},
		{
			name:                 "500 unshielded error with prefix and raw postgres error",
			statusCode:           fiber.StatusInternalServerError,
			inputMsg:             "failed to update payout limits: pq: relation 'limits' does not exist",
			expectedClientMsg:    "failed to update payout limits",
			expectedErrorDetails: "failed to update payout limits: pq: relation 'limits' does not exist",
		},
		{
			name:                 "500 bare postgres raw error",
			statusCode:           fiber.StatusInternalServerError,
			inputMsg:             "pq: duplicate key value violates unique constraint 'clients_email_key'",
			expectedClientMsg:    "Internal server error occurred",
			expectedErrorDetails: "pq: duplicate key value violates unique constraint 'clients_email_key'",
		},
		{
			name:                 "500 bare network connection error",
			statusCode:           fiber.StatusInternalServerError,
			inputMsg:             "dial tcp 127.0.0.1:5432: connect: connection refused",
			expectedClientMsg:    "Internal server error occurred",
			expectedErrorDetails: "dial tcp 127.0.0.1:5432: connect: connection refused",
		},
		{
			name:                 "Empty error message on 500",
			statusCode:           fiber.StatusInternalServerError,
			inputMsg:             "",
			expectedClientMsg:    "Internal server error occurred",
			expectedErrorDetails: "",
		},
		{
			name:                 "Empty error message on 400",
			statusCode:           fiber.StatusBadRequest,
			inputMsg:             "",
			expectedClientMsg:    "Invalid request",
			expectedErrorDetails: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			app := fiber.New()
			var recordedDetails string

			app.Get("/test", func(c *fiber.Ctx) error {
				err := Error(c, tc.statusCode, tc.inputMsg)
				if d, ok := c.Locals("error_details").(string); ok {
					recordedDetails = d
				}
				return err
			})

			req := httptest.NewRequest("GET", "/test", nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("unexpected error executing request: %v", err)
			}

			if resp.StatusCode != tc.statusCode {
				t.Errorf("expected status code %d, got %d", tc.statusCode, resp.StatusCode)
			}

			body, _ := io.ReadAll(resp.Body)
			var errResp ErrorResponse
			if err := json.Unmarshal(body, &errResp); err != nil {
				t.Fatalf("failed to decode JSON response: %v", err)
			}

			if errResp.Success != false {
				t.Errorf("expected Success to be false, got %v", errResp.Success)
			}

			if errResp.Message != tc.expectedClientMsg {
				t.Errorf("expected client message %q, got %q", tc.expectedClientMsg, errResp.Message)
			}

			if recordedDetails != tc.expectedErrorDetails {
				t.Errorf("expected error_details %q, got %q", tc.expectedErrorDetails, recordedDetails)
			}
		})
	}
}
