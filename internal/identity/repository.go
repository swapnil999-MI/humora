package identity

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

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
	// For superadmin or direct role query:
	query := `SELECT name, permissions FROM roles WHERE tenant_id = $1`
	rows, err := r.db.QueryContext(ctx, query, tenantID)
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

	// Fallback to superadmin if no specific mapping
	if len(roleNames) == 0 {
		roleNames = []string{"superadmin"}
		allPerms = []string{"*"}
	}

	return roleNames, allPerms, nil
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

func stringsIndex(s, substr string) int {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return len(s)
}
