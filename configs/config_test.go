package configs

import (
	"strings"
	"testing"
)

func TestValidateRejectsUnsafeProductionConfig(t *testing.T) {
	c := &Config{
		Server:        ServerConfig{Env: "production", JWTSecret: devJWTSecret, PasswordSecret: DevPasswordSecret, AllowedOrigins: "*"},
		StorageDriver: "minio",
		Minio:         MinioConfig{AccessKeyID: "minioadmin", SecretAccessKey: "minioadmin"},
	}
	errs := strings.Join(c.validate(), "\n")
	for _, want := range []string{"JWT_SECRET", "PASSWORD_SECRET", "FRONTEND_BASE_URL", "wildcard", "DB_PASSWORD", "MINIO"} {
		if !strings.Contains(errs, want) {
			t.Errorf("expected a validation error mentioning %s, got:\n%s", want, errs)
		}
	}
}

func TestValidateAcceptsSafeProductionConfig(t *testing.T) {
	c := &Config{
		Server: ServerConfig{
			Env:             "production",
			JWTSecret:       strings.Repeat("k", 48),
			PasswordSecret:  "a-real-secret",
			FrontendBaseURL: "https://hr.example.com",
			AllowedOrigins:  "https://hr.example.com",
		},
		DB:            DatabaseConfig{Password: "pw"},
		StorageDriver: "minio",
		Minio:         MinioConfig{AccessKeyID: "key", SecretAccessKey: "secret"},
	}
	if errs := c.validate(); len(errs) > 0 {
		t.Fatalf("expected no errors, got %v", errs)
	}
}

func TestValidateRejectsBiometricTestSwitches(t *testing.T) {
	t.Setenv("SKIP_LIVENESS_CHECK", "true")
	c := &Config{Server: ServerConfig{Env: "production"}}
	if errs := strings.Join(c.validate(), "\n"); !strings.Contains(errs, "SKIP_LIVENESS_CHECK") {
		t.Fatalf("expected SKIP_LIVENESS_CHECK to be rejected, got:\n%s", errs)
	}
}
