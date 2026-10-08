package middleware

import (
	"net/http/httptest"
	"testing"
	"time"

	"humora-backend/configs"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func signTestToken(t *testing.T, audience string, method jwt.SigningMethod) string {
	t.Helper()
	claims := UserClaims{
		UserID: "u1", TenantID: "t1", Role: "admin",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    TokenIssuer,
			Audience:  jwt.ClaimStrings{audience},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	s, err := jwt.NewWithClaims(method, claims).SignedString([]byte(configs.AppConfig.Server.JWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestAuthMiddlewareTokenAudience(t *testing.T) {
	configs.AppConfig = &configs.Config{Server: configs.ServerConfig{JWTSecret: "test-secret-test-secret-test-secret"}}

	app := fiber.New()
	app.Get("/", AuthMiddleware(), func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	cases := []struct {
		name  string
		token string
		want  int
	}{
		{"access token accepted", signTestToken(t, AccessTokenAudience, jwt.SigningMethodHS256), fiber.StatusOK},
		{"refresh token rejected", signTestToken(t, RefreshTokenAudience, jwt.SigningMethodHS256), fiber.StatusUnauthorized},
		{"other HMAC alg rejected", signTestToken(t, AccessTokenAudience, jwt.SigningMethodHS512), fiber.StatusUnauthorized},
	}
	for _, tc := range cases {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer "+tc.token)
		res, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != tc.want {
			t.Errorf("%s: got %d, want %d", tc.name, res.StatusCode, tc.want)
		}
	}
}

func TestRateLimiterMemoryFallback(t *testing.T) {
	configs.RedisClient = nil
	app := fiber.New()
	app.Get("/x", RateLimiter(2, time.Minute), func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	for i, want := range []int{200, 200, 429} {
		res, err := app.Test(httptest.NewRequest("GET", "/x", nil))
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != want {
			t.Fatalf("request %d: got %d, want %d", i+1, res.StatusCode, want)
		}
	}
}
