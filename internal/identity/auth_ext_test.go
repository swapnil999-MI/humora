package identity

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"humora-backend/configs"

	"github.com/google/uuid"
)

func TestAuthExtService_ProvidersAndQRFlow(t *testing.T) {
	configs.AppConfig = &configs.Config{
		Server: configs.ServerConfig{
			JWTSecret:            "test-jwt-secret-key-32-bytes-long",
			JWTAccessTokenExpiry: 15 * time.Minute,
		},
		OAuth: configs.OAuthConfig{
			GoogleClientID:     "mock-google-id",
			GoogleClientSecret: "mock-google-secret",
		},
	}

	repo := newMockRepository()
	ctx := context.Background()

	// 1. Create a dummy tenant and user in mock repo
	tenant := &Tenant{
		ID:   uuid.New(),
		Slug: "acme-corp",
		Name: "Acme Corp",
	}
	_ = repo.CreateTenant(ctx, tenant)

	user := &User{
		ID:       uuid.New(),
		TenantID: tenant.ID,
		Email:    "emp@acme.corp",
		Status:   "active",
	}
	_ = repo.CreateUser(ctx, user)

	authExt := NewAuthExtService(repo)

	// 2. Check enabled providers
	providers := authExt.GetEnabledProviders()
	if !providers.Google {
		t.Errorf("expected Google provider to be enabled")
	}
	if providers.Github {
		t.Errorf("expected Github provider to be disabled")
	}
	if !providers.QRCode {
		t.Errorf("expected QRCode to always be enabled")
	}

	// 3. Initiate QR login
	initRes, err := authExt.InitiateQRLogin(ctx, "203.0.113.9", "Chrome on Windows")
	if err != nil {
		t.Fatalf("unexpected error initiating QR login: %v", err)
	}
	if initRes.SessionID == "" || initRes.QRPayload == "" {
		t.Fatalf("expected non-empty session and payload")
	}

	// 4. Initial status should be "pending"
	statusRes, err := authExt.GetQRStatus(ctx, initRes.SessionID)
	if err != nil || statusRes.Status != "pending" {
		t.Fatalf("expected pending status, got %v (err: %v)", statusRes.Status, err)
	}

	// 5. The phone must have seen the QR code: the session id alone is not enough.
	parts := strings.Split(initRes.QRPayload, ":")
	nonce := parts[len(parts)-1]
	if err := authExt.ConfirmQRLogin(ctx, initRes.SessionID, "wrong-nonce", user.ID); err == nil {
		t.Fatalf("confirm with a wrong nonce must fail")
	}
	info, err := authExt.GetQRInfo(initRes.SessionID, nonce)
	if err != nil || info.RequesterIP != "203.0.113.9" || info.RequesterAgent != "Chrome on Windows" {
		t.Fatalf("qr info = %+v, %v", info, err)
	}
	err = authExt.ConfirmQRLogin(ctx, initRes.SessionID, nonce, user.ID)
	if err != nil {
		t.Fatalf("failed to confirm QR login: %v", err)
	}
	if err := authExt.ConfirmQRLogin(ctx, initRes.SessionID, nonce, user.ID); err == nil {
		t.Fatalf("a QR session must not be confirmed twice")
	}

	// 6. Next status check should return "authenticated" with AuthResponse
	authRes, err := authExt.GetQRStatus(ctx, initRes.SessionID)
	if err != nil {
		t.Fatalf("failed to check authenticated status: %v", err)
	}
	if authRes.Status != "authenticated" || authRes.Auth == nil {
		t.Fatalf("expected authenticated with auth tokens, got status %s", authRes.Status)
	}
	if authRes.Auth.AccessToken == "" {
		t.Errorf("expected non-empty access token")
	}
}

func TestOAuthNeedsChallengeAndReleasesTokensOnceToItsVerifier(t *testing.T) {
	configs.AppConfig = &configs.Config{OAuth: configs.OAuthConfig{GoogleClientID: "id", GoogleClientSecret: "secret"}}
	authExt := NewAuthExtService(newMockRepository())

	if _, err := authExt.InitiateOAuth("google", "web", ""); err == nil {
		t.Fatalf("starting OAuth without a code challenge must fail")
	}
	verifier := "a-long-random-verifier-held-only-by-the-client-0123456789"
	digest := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(digest[:])
	if _, err := authExt.InitiateOAuth("google", "web", challenge); err != nil {
		t.Fatalf("initiate: %v", err)
	}

	oauthCodes.Store("code-1", &OAuthCode{Auth: &AuthResponse{AccessToken: "tok"}, Challenge: challenge, ExpiresAt: time.Now().Add(time.Minute)})
	if _, err := authExt.ExchangeOAuthCode("code-1", "someone-elses-verifier"); err == nil {
		t.Fatalf("a wrong verifier must not release the tokens")
	}
	// A failed attempt burns the code too, so it cannot be retried with guesses.
	oauthCodes.Store("code-2", &OAuthCode{Auth: &AuthResponse{AccessToken: "tok"}, Challenge: challenge, ExpiresAt: time.Now().Add(time.Minute)})
	res, err := authExt.ExchangeOAuthCode("code-2", verifier)
	if err != nil || res.AccessToken != "tok" {
		t.Fatalf("exchange = %+v, %v", res, err)
	}
	if _, err := authExt.ExchangeOAuthCode("code-2", verifier); err == nil {
		t.Fatalf("a code must work only once")
	}
	oauthCodes.Store("code-3", &OAuthCode{Auth: &AuthResponse{}, Challenge: challenge, ExpiresAt: time.Now().Add(-time.Second)})
	if _, err := authExt.ExchangeOAuthCode("code-3", verifier); err == nil {
		t.Fatalf("an expired code must not work")
	}
}
