package hrms

import (
	"time"

	"github.com/google/uuid"
)

// CompanyProfile represents statutory, tax, address, and branding information for an organization.
type CompanyProfile struct {
	TenantID              uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Name                  string    `db:"name" json:"name"`
	LegalName             string    `db:"legal_name" json:"legal_name"`
	BrandTagline          string    `db:"brand_tagline" json:"brand_tagline"`
	LogoURL               string    `db:"logo_url" json:"logo_url"`
	CIN                   string    `db:"cin" json:"cin"`
	GSTIN                 string    `db:"gstin" json:"gstin"`
	PAN                   string    `db:"pan" json:"pan"`
	TAN                   string    `db:"tan" json:"tan"`
	PFCode                string    `db:"pf_code" json:"pf_code"`
	ESICode               string    `db:"esi_code" json:"esi_code"`
	AddressLine1          string    `db:"address_line1" json:"address_line1"`
	AddressLine2          string    `db:"address_line2" json:"address_line2"`
	City                  string    `db:"city" json:"city"`
	State                 string    `db:"state" json:"state"`
	Pincode               string    `db:"pincode" json:"pincode"`
	Country               string    `db:"country" json:"country"`
	ContactEmail          string    `db:"contact_email" json:"contact_email"`
	ContactPhone          string    `db:"contact_phone" json:"contact_phone"`
	Website               string    `db:"website" json:"website"`
	SignatoryName         string    `db:"signatory_name" json:"signatory_name"`
	SignatoryTitle        string    `db:"signatory_title" json:"signatory_title"`
	SignatorySignatureURL string    `db:"signatory_signature_url" json:"signatory_signature_url"`
	PayCycleStartDay      int       `db:"pay_cycle_start_day" json:"pay_cycle_start_day"`
	CreatedAt             time.Time `db:"created_at" json:"created_at"`
	UpdatedAt             time.Time `db:"updated_at" json:"updated_at"`
}

// TenantSMTPConfig represents the SMTP delivery gateway configured by an admin.
type TenantSMTPConfig struct {
	TenantID          uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	Host              string     `db:"host" json:"host"`
	Port              int        `db:"port" json:"port"`
	Username          string     `db:"username" json:"username"`
	PasswordEncrypted string     `db:"password_encrypted" json:"-"`
	FromEmail         string     `db:"from_email" json:"from_email"`
	FromName          string     `db:"from_name" json:"from_name"`
	Encryption        string     `db:"encryption" json:"encryption"`
	IsVerified        bool       `db:"is_verified" json:"is_verified"`
	LastTestedAt      *time.Time `db:"last_tested_at" json:"last_tested_at,omitempty"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at" json:"updated_at"`
}

type TenantSMTPConfigResponse struct {
	Host         string     `json:"host"`
	Port         int        `json:"port"`
	Username     string     `json:"username"`
	HasPassword  bool       `json:"has_password"`
	FromEmail    string     `json:"from_email"`
	FromName     string     `json:"from_name"`
	Encryption   string     `json:"encryption"`
	IsVerified   bool       `json:"is_verified"`
	LastTestedAt *time.Time `json:"last_tested_at,omitempty"`
}

type SaveSMTPConfigRequest struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password,omitempty"`
	FromEmail  string `json:"from_email"`
	FromName   string `json:"from_name"`
	Encryption string `json:"encryption"` // "starttls", "ssl", "none"
}

type TestSMTPRequest struct {
	RecipientEmail string `json:"recipient_email"`
	Host           string `json:"host,omitempty"`
	Port           int    `json:"port,omitempty"`
	Username       string `json:"username,omitempty"`
	Password       string `json:"password,omitempty"`
	FromEmail      string `json:"from_email,omitempty"`
	FromName       string `json:"from_name,omitempty"`
	Encryption     string `json:"encryption,omitempty"`
}
