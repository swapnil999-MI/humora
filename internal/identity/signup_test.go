package identity

import (
	"context"
	"errors"
	"testing"
	"time"

	"humora-backend/configs"
)

func TestRegisterOnlyCreatesFirstOrganizationOutsideLocal(t *testing.T) {
	configs.AppConfig = &configs.Config{
		Server: configs.ServerConfig{
			Env:                   "production",
			JWTSecret:             "test-jwt-secret-key-32-bytes-long",
			JWTAccessTokenExpiry:  15 * time.Minute,
			JWTRefreshTokenExpiry: 24 * time.Hour,
		},
	}
	svc := NewService(newMockRepository())
	ctx := context.Background()
	req := func(slug, email string) *RegisterRequest {
		return &RegisterRequest{OrganizationName: slug, Slug: slug, AdminEmail: email, AdminPassword: "Password123!", FirstName: "A"}
	}

	if _, err := svc.Register(ctx, req("first", "a@first.io")); err != nil {
		t.Fatalf("first organization should register: %v", err)
	}
	if svc.SignupOpen(ctx) {
		t.Fatal("signup must close once an organization exists")
	}
	if _, err := svc.Register(ctx, req("second", "b@second.io")); !errors.Is(err, ErrSignupClosed) {
		t.Fatalf("expected ErrSignupClosed for a second organization, got %v", err)
	}

	configs.AppConfig.Server.PublicSignup = true
	if _, err := svc.Register(ctx, req("third", "c@third.io")); err != nil {
		t.Fatalf("PUBLIC_SIGNUP=true should allow more organizations: %v", err)
	}
}

func TestVerifyPasswordRejectsNonArgonValues(t *testing.T) {
	if ok, _ := verifyPassword("Password@123", "Password@123"); ok {
		t.Fatal("a plaintext value in password_hash must never authenticate")
	}
}
