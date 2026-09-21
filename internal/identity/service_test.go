package identity

import (
	"context"
	"testing"
	"time"

	"humora-backend/configs"

	"github.com/google/uuid"
)

type mockRepository struct {
	tenants map[string]*Tenant
	users   map[string]*User
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		tenants: make(map[string]*Tenant),
		users:   make(map[string]*User),
	}
}

func (m *mockRepository) CreateTenant(ctx context.Context, tenant *Tenant) error {
	m.tenants[tenant.Slug] = tenant
	return nil
}

func (m *mockRepository) GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error) {
	return m.tenants[slug], nil
}

func (m *mockRepository) GetTenantByID(ctx context.Context, id uuid.UUID) (*Tenant, error) {
	for _, t := range m.tenants {
		if t.ID == id {
			return t, nil
		}
	}
	return nil, nil
}

func (m *mockRepository) CreateUser(ctx context.Context, user *User) error {
	m.users[user.Email] = user
	return nil
}

func (m *mockRepository) GetUserByEmail(ctx context.Context, email string) (*User, *Tenant, error) {
	u := m.users[email]
	if u == nil {
		return nil, nil, nil
	}
	for _, t := range m.tenants {
		if t.ID == u.TenantID {
			return u, t, nil
		}
	}
	return u, nil, nil
}

func (m *mockRepository) GetUserByEmailAndTenant(ctx context.Context, tenantID uuid.UUID, email string) (*User, error) {
	u := m.users[email]
	if u != nil && u.TenantID == tenantID {
		return u, nil
	}
	return nil, nil
}

func (m *mockRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *mockRepository) UpdatePresence(ctx context.Context, id uuid.UUID, presence string) error {
	for _, u := range m.users {
		if u.ID == id {
			u.PresenceStatus = presence
			return nil
		}
	}
	return nil
}

func (m *mockRepository) RegisterDevicePublicKey(ctx context.Context, id uuid.UUID, publicKey string) error {
	for _, u := range m.users {
		if u.ID == id {
			u.DevicePublicKey = &publicKey
			return nil
		}
	}
	return nil
}

func (m *mockRepository) CreateDefaultRoles(ctx context.Context, tenantID uuid.UUID) error {
	return nil
}

func (m *mockRepository) GetRolesForUser(ctx context.Context, tenantID uuid.UUID, userID uuid.UUID) ([]string, []string, error) {
	return []string{"superadmin"}, []string{"*"}, nil
}

func (m *mockRepository) CreateDefaultHRMSEmployee(ctx context.Context, tenantID uuid.UUID, userID uuid.UUID, email, firstName, lastName string) error {
	return nil
}

func TestIdentityService_RegisterAndLoginFlow(t *testing.T) {
	// Initialize minimal config
	configs.AppConfig = &configs.Config{
		Server: configs.ServerConfig{
			JWTSecret:             "test-jwt-secret-key-32-bytes-long",
			JWTAccessTokenExpiry:  15 * time.Minute,
			JWTRefreshTokenExpiry: 24 * time.Hour,
		},
	}

	repo := newMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	// 1. Register organization
	regReq := &RegisterRequest{
		OrganizationName: "Test Innovations Inc",
		Slug:             "test-org",
		AdminEmail:       "lead@test.org",
		AdminPassword:    "Password123!",
		FirstName:        "Dev",
		LastName:         "User",
	}

	res, err := svc.Register(ctx, regReq)
	if err != nil {
		t.Fatalf("unexpected error registering: %v", err)
	}

	if res.AccessToken == "" || res.RefreshToken == "" {
		t.Fatalf("expected non-empty tokens, got empty")
	}

	if res.User.Email != "lead@test.org" {
		t.Errorf("expected email 'lead@test.org', got %s", res.User.Email)
	}

	// 2. Login
	loginReq := &LoginRequest{
		Email:    "lead@test.org",
		Password: "Password123!",
	}

	loginRes, err := svc.Login(ctx, loginReq)
	if err != nil {
		t.Fatalf("unexpected login error: %v", err)
	}

	if loginRes.AccessToken == "" {
		t.Fatalf("expected valid access token on login")
	}

	// 3. Login with wrong password
	badLogin := &LoginRequest{
		Email:    "lead@test.org",
		Password: "WrongPassword!",
	}
	_, err = svc.Login(ctx, badLogin)
	if err == nil {
		t.Fatalf("expected error on invalid password, got nil")
	}

	// 4. Refresh token
	refreshRes, err := svc.RefreshToken(ctx, loginRes.RefreshToken)
	if err != nil {
		t.Fatalf("unexpected refresh error: %v", err)
	}
	if refreshRes.AccessToken == "" {
		t.Fatalf("expected renewed access token")
	}
}
