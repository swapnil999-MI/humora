package identity

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"humora-backend/configs"
	"humora-backend/pkg/mailer"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	CreateTenant(ctx context.Context, tenant *Tenant) error
	GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error)
	GetTenantByID(ctx context.Context, id uuid.UUID) (*Tenant, error)

	CreateUser(ctx context.Context, user *User) error
	GetUserByEmail(ctx context.Context, email string) (*User, *Tenant, error)
	GetUserByEmailAndTenant(ctx context.Context, tenantID uuid.UUID, email string) (*User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*User, error)
	UpdateLastLogin(ctx context.Context, id uuid.UUID) error
	UpdatePresence(ctx context.Context, id uuid.UUID, presence string) error
	RegisterDevicePublicKey(ctx context.Context, id uuid.UUID, publicKey string) error

	CreateDefaultRoles(ctx context.Context, tenantID uuid.UUID) error
	GetRolesForUser(ctx context.Context, tenantID uuid.UUID, userID uuid.UUID) ([]string, []string, error)
	CreateDefaultHRMSEmployee(ctx context.Context, tenantID uuid.UUID, userID uuid.UUID, email, firstName, lastName string) error
	CheckEmailConflict(ctx context.Context, email string) (bool, string, error)
	AssignRoleToUser(ctx context.Context, userID, roleID uuid.UUID) error
	GetRoleByName(ctx context.Context, tenantID uuid.UUID, name string) (*Role, error)
	SavePasswordResetOTP(ctx context.Context, tenantID, userID uuid.UUID, email, otp string, expiresAt time.Time) error
	VerifyPasswordResetOTP(ctx context.Context, email, otp string) (uuid.UUID, error)
	UpdateUserPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error
	GetTenantSMTPConfig(ctx context.Context, tenantID uuid.UUID) (*mailer.SMTPConfig, error)
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateTenant(ctx context.Context, tenant *Tenant) error {
	query := `
		INSERT INTO tenants (id, slug, name, domain, subscription_tier, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	if tenant.ID == uuid.Nil {
		tenant.ID = uuid.New()
	}
	now := time.Now().UTC()
	tenant.CreatedAt = now
	tenant.UpdatedAt = now

	_, err := r.db.ExecContext(ctx, query,
		tenant.ID, tenant.Slug, tenant.Name, tenant.Domain, tenant.SubscriptionTier, tenant.CreatedAt, tenant.UpdatedAt,
	)
	return err
}

func (r *repository) GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error) {
	var tenant Tenant
	query := `SELECT id, slug, name, domain, subscription_tier, created_at, updated_at FROM tenants WHERE slug = $1 LIMIT 1`
	err := r.db.GetContext(ctx, &tenant, query, slug)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &tenant, nil
}

func (r *repository) GetTenantByID(ctx context.Context, id uuid.UUID) (*Tenant, error) {
	var tenant Tenant
	query := `SELECT id, slug, name, domain, subscription_tier, created_at, updated_at FROM tenants WHERE id = $1 LIMIT 1`
	err := r.db.GetContext(ctx, &tenant, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &tenant, nil
}

func (r *repository) CreateUser(ctx context.Context, user *User) error {
	query := `
		INSERT INTO users (id, tenant_id, email, password_hash, status, presence_status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	now := time.Now().UTC()
	user.CreatedAt = now
	user.UpdatedAt = now
	if user.Status == "" {
		user.Status = "active"
	}
	if user.PresenceStatus == "" {
		user.PresenceStatus = "offline"
	}

	_, err := r.db.ExecContext(ctx, query,
		user.ID, user.TenantID, user.Email, user.PasswordHash, user.Status, user.PresenceStatus, user.CreatedAt, user.UpdatedAt,
	)
	return err
}

func (r *repository) GetUserByEmail(ctx context.Context, email string) (*User, *Tenant, error) {
	var user User
	var tenant Tenant

	userQuery := `
		SELECT id, tenant_id, email, password_hash, status, device_public_key, presence_status, last_login_at, created_at, updated_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &user, userQuery, email)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil, nil
		}
		return nil, nil, err
	}

	tenantQuery := `SELECT id, slug, name, domain, subscription_tier, created_at, updated_at FROM tenants WHERE id = $1`
	if err := r.db.GetContext(ctx, &tenant, tenantQuery, user.TenantID); err != nil {
		return &user, nil, nil
	}

	return &user, &tenant, nil
}

func (r *repository) GetUserByEmailAndTenant(ctx context.Context, tenantID uuid.UUID, email string) (*User, error) {
	var user User
	query := `
		SELECT id, tenant_id, email, password_hash, status, device_public_key, presence_status, last_login_at, created_at, updated_at
		FROM users
		WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &user, query, tenantID, email)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *repository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var user User
	query := `
		SELECT id, tenant_id, email, password_hash, status, device_public_key, presence_status, last_login_at, created_at, updated_at
		FROM users
		WHERE id = $1
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &user, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *repository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	query := `UPDATE users SET last_login_at = $1, updated_at = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, now, id)
	return err
}

func (r *repository) UpdatePresence(ctx context.Context, id uuid.UUID, presence string) error {
	query := `UPDATE users SET presence_status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, presence, id)
	return err
}

func (r *repository) RegisterDevicePublicKey(ctx context.Context, id uuid.UUID, publicKey string) error {
	query := `UPDATE users SET device_public_key = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, publicKey, id)
	return err
}

func (r *repository) CreateDefaultRoles(ctx context.Context, tenantID uuid.UUID) error {
	roles := []struct {
		Name  string
		Perms []string
	}{
		{Name: "superadmin", Perms: []string{"*"}},
		{Name: "hr_admin", Perms: []string{"hrms:*", "work:read"}},
		{Name: "project_lead", Perms: []string{"work:*", "hrms:read"}},
		{Name: "employee", Perms: []string{"hrms:self", "work:self"}},
	}

	for _, role := range roles {
		permsJSON, _ := json.Marshal(role.Perms)
		query := `
			INSERT INTO roles (id, tenant_id, name, permissions, created_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (tenant_id, name) DO NOTHING
		`
		if _, err := r.db.ExecContext(ctx, query, uuid.New(), tenantID, role.Name, string(permsJSON)); err != nil {
			return err
		}
	}
	return nil
}

func (r *repository) GetRolesForUser(ctx context.Context, tenantID uuid.UUID, userID uuid.UUID) ([]string, []string, error) {
	query := `
		SELECT r.name, r.permissions
		FROM user_roles ur
		JOIN roles r ON ur.role_id = r.id
		WHERE ur.user_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var roleNames []string
	permSet := make(map[string]bool)

	for rows.Next() {
		var name, permsRaw string
		if err := rows.Scan(&name, &permsRaw); err == nil {
			roleNames = append(roleNames, name)
			var perms []string
			if err := json.Unmarshal([]byte(permsRaw), &perms); err == nil {
				for _, p := range perms {
					permSet[p] = true
				}
			}
		}
	}

	var allPerms []string
	for p := range permSet {
		allPerms = append(allPerms, p)
	}

	// Fallback to employee if no explicit role is mapped
	if len(roleNames) == 0 {
		roleNames = []string{"employee"}
		allPerms = []string{"hrms:self", "work:self"}
	}

	return roleNames, allPerms, nil
}

func (r *repository) CheckEmailConflict(ctx context.Context, email string) (bool, string, error) {
	emailLower := strings.ToLower(strings.TrimSpace(email))

	// 1. Check users
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM users WHERE LOWER(email) = $1`, emailLower)
	if err != nil {
		return false, "", err
	}
	if count > 0 {
		return true, "users", nil
	}

	// 2. Check hrms_employees
	err = r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM hrms_employees WHERE LOWER(work_email) = $1 OR (personal_email IS NOT NULL AND LOWER(personal_email) = $1)`, emailLower)
	if err != nil {
		return false, "", err
	}
	if count > 0 {
		return true, "hrms_employees", nil
	}

	// 3. Check onboarding candidates
	err = r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM hrms_onboarding_candidates WHERE LOWER(personal_email) = $1`, emailLower)
	if err != nil {
		return false, "", err
	}
	if count > 0 {
		return true, "hrms_onboarding_candidates", nil
	}

	return false, "", nil
}

func (r *repository) AssignRoleToUser(ctx context.Context, userID, roleID uuid.UUID) error {
	query := `INSERT INTO user_roles (user_id, role_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`
	_, err := r.db.ExecContext(ctx, query, userID, roleID)
	return err
}

func (r *repository) GetRoleByName(ctx context.Context, tenantID uuid.UUID, name string) (*Role, error) {
	var role Role
	var permsRaw string
	query := `SELECT id, tenant_id, name, permissions::text, created_at FROM roles WHERE tenant_id = $1 AND name = $2`
	row := r.db.QueryRowContext(ctx, query, tenantID, name)
	if err := row.Scan(&role.ID, &role.TenantID, &role.Name, &permsRaw, &role.CreatedAt); err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(permsRaw), &role.Permissions)
	return &role, nil
}

func (r *repository) CreateDefaultHRMSEmployee(ctx context.Context, tenantID uuid.UUID, userID uuid.UUID, email, firstName, lastName string) error {
	empCode := fmt.Sprintf("EMP-%s", email[:stringsIndex(email, "@")])
	if len(empCode) > 20 {
		empCode = empCode[:20]
	}
	query := `
		INSERT INTO hrms_employees (
			id, tenant_id, user_id, employee_code, first_name, last_name, work_email,
			date_of_joining, employment_type, status, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, 'full_time', 'active', NOW(), NOW())
		ON CONFLICT (tenant_id, work_email) DO NOTHING
	`
	_, err := r.db.ExecContext(ctx, query, uuid.New(), tenantID, userID, empCode, firstName, lastName, email)
	return err
}

func (r *repository) SavePasswordResetOTP(ctx context.Context, tenantID, userID uuid.UUID, email, otp string, expiresAt time.Time) error {
	// Invalidate any previous unused OTPs for this email
	_, _ = r.db.ExecContext(ctx, `UPDATE password_reset_otps SET used = TRUE WHERE LOWER(email) = LOWER($1) AND used = FALSE`, email)

	query := `
		INSERT INTO password_reset_otps (id, tenant_id, email, otp_code, expires_at, used, created_at)
		VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
	`
	_, err := r.db.ExecContext(ctx, query, uuid.New(), tenantID, strings.ToLower(email), otp, expiresAt)
	return err
}

func (r *repository) VerifyPasswordResetOTP(ctx context.Context, email, otp string) (uuid.UUID, error) {
	var record struct {
		ID        uuid.UUID `db:"id"`
		UserID    uuid.UUID `db:"user_id"`
		ExpiresAt time.Time `db:"expires_at"`
		Used      bool      `db:"used"`
	}
	query := `
		SELECT o.id, u.id AS user_id, o.expires_at, o.used
		FROM password_reset_otps o
		JOIN users u ON LOWER(o.email) = LOWER(u.email)
		WHERE LOWER(o.email) = LOWER($1) AND o.otp_code = $2 AND o.used = FALSE
		ORDER BY o.created_at DESC
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &record, query, strings.ToLower(email), strings.TrimSpace(otp))
	if err != nil {
		return uuid.Nil, errors.New("invalid or expired OTP verification code")
	}

	if time.Now().After(record.ExpiresAt) {
		return uuid.Nil, errors.New("OTP verification code has expired. Please request a new one")
	}

	// Mark as used
	_, _ = r.db.ExecContext(ctx, `UPDATE password_reset_otps SET used = TRUE WHERE id = $1`, record.ID)

	return record.UserID, nil
}

func (r *repository) UpdateUserPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, passwordHash, userID)
	return err
}

func (r *repository) GetTenantSMTPConfig(ctx context.Context, tenantID uuid.UUID) (*mailer.SMTPConfig, error) {
	var cfg struct {
		Host              string `db:"host"`
		Port              int    `db:"port"`
		Username          string `db:"username"`
		PasswordEncrypted string `db:"password_encrypted"`
		FromEmail         string `db:"from_email"`
		FromName          string `db:"from_name"`
		Encryption        string `db:"encryption"`
	}
	err := r.db.GetContext(ctx, &cfg, `SELECT host, port, username, password_encrypted, from_email, from_name, encryption FROM tenant_smtp_configs WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, nil // No config configured yet
	}

	plainPass := ""
	if cfg.PasswordEncrypted != "" {
		dec, decErr := decryptIdentitySecret(cfg.PasswordEncrypted)
		if decErr == nil {
			plainPass = dec
		}
	}

	return &mailer.SMTPConfig{
		Host:       cfg.Host,
		Port:       cfg.Port,
		Username:   cfg.Username,
		Password:   plainPass,
		FromEmail:  cfg.FromEmail,
		FromName:   cfg.FromName,
		Encryption: cfg.Encryption,
	}, nil
}

func decryptIdentitySecret(cipherTextBase64 string) (string, error) {
	if cipherTextBase64 == "" {
		return "", nil
	}
	data, err := base64.StdEncoding.DecodeString(cipherTextBase64)
	if err != nil {
		return "", err
	}
	secret := configs.AppConfig.Server.PasswordSecret
	if secret == "" {
		secret = "humora-secret-salt-2026"
	}
	key := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("malformed ciphertext")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func stringsIndex(s, substr string) int {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return len(s)
}
