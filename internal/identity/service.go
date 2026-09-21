package identity

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"humora-backend/configs"
	"humora-backend/pkg/middleware"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

type Service interface {
	Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error)
	Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error)
	RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error)
	GetProfile(ctx context.Context, userID uuid.UUID) (*UserSummary, error)
	UpdatePresence(ctx context.Context, userID uuid.UUID, status string) error
	RegisterDeviceKey(ctx context.Context, userID uuid.UUID, publicKey string) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error) {
	if validationErr := req.Validate(); validationErr != "" {
		return nil, errors.New(validationErr)
	}

	// 1. Check if tenant slug already exists
	existingTenant, err := s.repo.GetTenantBySlug(ctx, req.Slug)
	if err != nil {
		return nil, fmt.Errorf("failed to check tenant: %w", err)
	}
	if existingTenant != nil {
		return nil, fmt.Errorf("tenant slug %q is already taken", req.Slug)
	}

	// 2. Hash Password with Argon2id
	hash, err := hashPassword(req.AdminPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 3. Create Tenant
	tenant := &Tenant{
		ID:               uuid.New(),
		Slug:             req.Slug,
		Name:             req.OrganizationName,
		SubscriptionTier: "enterprise",
	}
	if req.Domain != "" {
		tenant.Domain = &req.Domain
	}
	if err := s.repo.CreateTenant(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	// 4. Create Default Roles for Tenant
	_ = s.repo.CreateDefaultRoles(ctx, tenant.ID)

	// 5. Create Admin User
	user := &User{
		ID:             uuid.New(),
		TenantID:       tenant.ID,
		Email:          strings.ToLower(strings.TrimSpace(req.AdminEmail)),
		PasswordHash:   hash,
		Status:         "active",
		PresenceStatus: "in_office_active",
	}
	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create admin user: %w", err)
	}

	// 6. Create HRMS Employee entry linked to user
	_ = s.repo.CreateDefaultHRMSEmployee(ctx, tenant.ID, user.ID, user.Email, req.FirstName, req.LastName)

	// 7. Generate Tokens
	roles, perms, _ := s.repo.GetRolesForUser(ctx, tenant.ID, user.ID)
	accessToken, refreshToken, err := generateTokens(user, tenant, roles, perms)
	if err != nil {
		return nil, fmt.Errorf("failed to generate auth tokens: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(configs.AppConfig.Server.JWTAccessTokenExpiry.Seconds()),
		User: UserSummary{
			ID:             user.ID.String(),
			TenantID:       tenant.ID.String(),
			TenantName:     tenant.Name,
			TenantSlug:     tenant.Slug,
			Email:          user.Email,
			Status:         user.Status,
			PresenceStatus: user.PresenceStatus,
			Roles:          roles,
			Permissions:    perms,
		},
	}, nil
}

func (s *service) Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error) {
	if validationErr := req.Validate(); validationErr != "" {
		return nil, errors.New(validationErr)
	}

	var user *User
	var tenant *Tenant
	var err error

	email := strings.ToLower(strings.TrimSpace(req.Email))

	if req.TenantSlug != "" {
		tenant, err = s.repo.GetTenantBySlug(ctx, req.TenantSlug)
		if err != nil || tenant == nil {
			return nil, errors.New("organization not found")
		}
		user, err = s.repo.GetUserByEmailAndTenant(ctx, tenant.ID, email)
	} else {
		user, tenant, err = s.repo.GetUserByEmail(ctx, email)
	}

	if err != nil || user == nil || tenant == nil {
		return nil, errors.New("invalid email or password")
	}

	if user.Status != "active" {
		return nil, fmt.Errorf("account is %s. please contact your administrator", user.Status)
	}

	// Verify Argon2id or legacy password
	valid, err := verifyPassword(req.Password, user.PasswordHash)
	if err != nil || !valid {
		return nil, errors.New("invalid email or password")
	}

	// Update last login
	_ = s.repo.UpdateLastLogin(ctx, user.ID)

	roles, perms, _ := s.repo.GetRolesForUser(ctx, tenant.ID, user.ID)
	accessToken, refreshToken, err := generateTokens(user, tenant, roles, perms)
	if err != nil {
		return nil, fmt.Errorf("failed to generate auth tokens: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(configs.AppConfig.Server.JWTAccessTokenExpiry.Seconds()),
		User: UserSummary{
			ID:             user.ID.String(),
			TenantID:       tenant.ID.String(),
			TenantName:     tenant.Name,
			TenantSlug:     tenant.Slug,
			Email:          user.Email,
			Status:         user.Status,
			PresenceStatus: user.PresenceStatus,
			Roles:          roles,
			Permissions:    perms,
		},
	}, nil
}

func (s *service) RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	if refreshToken == "" {
		return nil, errors.New("refresh_token is required")
	}

	token, err := jwt.ParseWithClaims(refreshToken, &middleware.UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(configs.AppConfig.Server.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired refresh token")
	}

	claims, ok := token.Claims.(*middleware.UserClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, errors.New("invalid user identifier in token")
	}

	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user account no longer exists")
	}

	tenant, err := s.repo.GetTenantByID(ctx, user.TenantID)
	if err != nil || tenant == nil {
		return nil, errors.New("tenant organization not found")
	}

	roles, perms, _ := s.repo.GetRolesForUser(ctx, tenant.ID, user.ID)
	newAccessToken, newRefreshToken, err := generateTokens(user, tenant, roles, perms)
	if err != nil {
		return nil, fmt.Errorf("failed to regenerate tokens: %w", err)
	}

	return &AuthResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(configs.AppConfig.Server.JWTAccessTokenExpiry.Seconds()),
		User: UserSummary{
			ID:             user.ID.String(),
			TenantID:       tenant.ID.String(),
			TenantName:     tenant.Name,
			TenantSlug:     tenant.Slug,
			Email:          user.Email,
			Status:         user.Status,
			PresenceStatus: user.PresenceStatus,
			Roles:          roles,
			Permissions:    perms,
		},
	}, nil
}

func (s *service) GetProfile(ctx context.Context, userID uuid.UUID) (*UserSummary, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}

	tenant, err := s.repo.GetTenantByID(ctx, user.TenantID)
	if err != nil || tenant == nil {
		return nil, errors.New("tenant not found")
	}

	roles, perms, _ := s.repo.GetRolesForUser(ctx, tenant.ID, user.ID)
	return &UserSummary{
		ID:             user.ID.String(),
		TenantID:       tenant.ID.String(),
		TenantName:     tenant.Name,
		TenantSlug:     tenant.Slug,
		Email:          user.Email,
		Status:         user.Status,
		PresenceStatus: user.PresenceStatus,
		Roles:          roles,
		Permissions:    perms,
	}, nil
}

func (s *service) UpdatePresence(ctx context.Context, userID uuid.UUID, status string) error {
	return s.repo.UpdatePresence(ctx, userID, status)
}

func (s *service) RegisterDeviceKey(ctx context.Context, userID uuid.UUID, publicKey string) error {
	return s.repo.RegisterDevicePublicKey(ctx, userID, publicKey)
}

// Helper: Token Generation
func generateTokens(user *User, tenant *Tenant, roles, perms []string) (string, string, error) {
	now := time.Now().UTC()
	accessExpiry := now.Add(configs.AppConfig.Server.JWTAccessTokenExpiry)
	refreshExpiry := now.Add(configs.AppConfig.Server.JWTRefreshTokenExpiry)

	primaryRole := "employee"
	if len(roles) > 0 {
		primaryRole = roles[0]
	}

	accessClaims := middleware.UserClaims{
		UserID:   user.ID.String(),
		TenantID: tenant.ID.String(),
		Email:    user.Email,
		Role:     primaryRole,
		Perms:    perms,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   user.ID.String(),
			Issuer:    "humora-auth",
		},
	}

	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := accessTokenObj.SignedString([]byte(configs.AppConfig.Server.JWTSecret))
	if err != nil {
		return "", "", err
	}

	refreshClaims := middleware.UserClaims{
		UserID:   user.ID.String(),
		TenantID: tenant.ID.String(),
		Email:    user.Email,
		Role:     primaryRole,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExpiry),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   user.ID.String(),
			Issuer:    "humora-auth",
		},
	}

	refreshTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := refreshTokenObj.SignedString([]byte(configs.AppConfig.Server.JWTSecret))
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// Helper: Argon2id Password Hashing
func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	timeCost := uint32(3)
	memoryCost := uint32(64 * 1024)
	threads := uint8(2)
	keyLen := uint32(32)

	hash := argon2.IDKey([]byte(password), salt, timeCost, memoryCost, threads, keyLen)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encoded := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, memoryCost, timeCost, threads, b64Salt, b64Hash)
	return encoded, nil
}

// Helper: Argon2id Password Verification
func verifyPassword(password, encodedHash string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		// Fallback simple comparison for testing / legacy
		if subtle.ConstantTimeCompare([]byte(password), []byte(encodedHash)) == 1 {
			return true, nil
		}
		return false, errors.New("incompatible hash format")
	}

	var version int
	var memory uint32
	var timeCost uint32
	var threads uint8

	_, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &timeCost, &threads)
	if err != nil {
		return false, err
	}
	_ = version

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}

	decodedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, err
	}

	comparisonHash := argon2.IDKey([]byte(password), salt, timeCost, memory, threads, uint32(len(decodedHash)))

	if subtle.ConstantTimeCompare(decodedHash, comparisonHash) == 1 {
		return true, nil
	}
	return false, nil
}
