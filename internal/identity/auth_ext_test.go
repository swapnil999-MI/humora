package identity

import (
	"context"
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
	initRes, err := authExt.InitiateQRLogin(ctx)
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

	// 5. Mobile confirms QR login
	err = authExt.ConfirmQRLogin(ctx, initRes.SessionID, user.ID)
	if err != nil {
		t.Fatalf("failed to confirm QR login: %v", err)
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
