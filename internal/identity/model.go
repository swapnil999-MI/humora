package identity

import (
	"time"

	"github.com/google/uuid"
)

// Tenant represents an organization in the multi-tenant system.
type Tenant struct {
	ID               uuid.UUID `db:"id" json:"id"`
	Slug             string    `db:"slug" json:"slug"`
	Name             string    `db:"name" json:"name"`
	Domain           *string   `db:"domain" json:"domain,omitempty"`
	SubscriptionTier string    `db:"subscription_tier" json:"subscription_tier"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time `db:"updated_at" json:"updated_at"`
}

// User represents user credentials, identity, and global presence state.
type User struct {
	ID              uuid.UUID  `db:"id" json:"id"`
	TenantID        uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	Email           string     `db:"email" json:"email"`
	PasswordHash    string     `db:"password_hash" json:"-"`
	Status          string     `db:"status" json:"status"` // 'active', 'invited', 'suspended'
	DevicePublicKey *string    `db:"device_public_key" json:"device_public_key,omitempty"`
	PresenceStatus  string     `db:"presence_status" json:"presence_status"` // 'offline', 'in_office_active', 'on_leave'
	LastLoginAt     *time.Time `db:"last_login_at" json:"last_login_at,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

// Role defines an authorization group with JSONB permissions.
type Role struct {
	ID          uuid.UUID `db:"id" json:"id"`
	TenantID    uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Permissions string    `db:"permissions" json:"permissions"` // JSON array string
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}
