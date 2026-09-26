package hrms

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"humora-backend/configs"
	"humora-backend/pkg/mailer"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type CompanyService interface {
	GetCompanyProfile(ctx context.Context, tenantID uuid.UUID) (*CompanyProfile, error)
	UpdateCompanyProfile(ctx context.Context, tenantID uuid.UUID, profile *CompanyProfile) (*CompanyProfile, error)
	GetSMTPConfig(ctx context.Context, tenantID uuid.UUID) (*TenantSMTPConfigResponse, error)
	SaveSMTPConfig(ctx context.Context, tenantID uuid.UUID, req *SaveSMTPConfigRequest) (*TenantSMTPConfigResponse, error)
	TestSMTPConfig(ctx context.Context, tenantID uuid.UUID, req *TestSMTPRequest) error
	GetActiveMailerConfig(ctx context.Context, tenantID uuid.UUID) (*mailer.SMTPConfig, error)
}

type companyService struct {
	db *sqlx.DB
}

func NewCompanyService(db *sqlx.DB) CompanyService {
	return &companyService{db: db}
}

func getEncryptionKey() []byte {
	secret := configs.AppConfig.Server.PasswordSecret
	if secret == "" {
		secret = "humora-secret-salt-2026"
	}
	hash := sha256.Sum256([]byte(secret))
	return hash[:]
}

func encryptText(plainText string) (string, error) {
	if plainText == "" {
		return "", nil
	}
	key := getEncryptionKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plainText), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decryptText(cipherTextBase64 string) (string, error) {
	if cipherTextBase64 == "" {
		return "", nil
	}
	data, err := base64.StdEncoding.DecodeString(cipherTextBase64)
	if err != nil {
		return "", err
	}
	key := getEncryptionKey()
	block, err := aes.NewCipher(key)
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

func (s *companyService) GetCompanyProfile(ctx context.Context, tenantID uuid.UUID) (*CompanyProfile, error) {
	var profile CompanyProfile
	query := `SELECT * FROM company_profiles WHERE tenant_id = $1`
	err := s.db.GetContext(ctx, &profile, query, tenantID)
	if err != nil {
		// Fallback: create default profile from tenant
		var tenantName string
		_ = s.db.GetContext(ctx, &tenantName, `SELECT name FROM tenants WHERE id = $1`, tenantID)
		if tenantName == "" {
			tenantName = "My Enterprise"
		}
		profile = CompanyProfile{
			TenantID:         tenantID,
			Name:             tenantName,
			LegalName:        tenantName,
			Country:          "India",
			PayCycleStartDay: 1,
			CreatedAt:        time.Now().UTC(),
			UpdatedAt:        time.Now().UTC(),
		}
		insertQuery := `
			INSERT INTO company_profiles (tenant_id, name, legal_name, country, pay_cycle_start_day, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT (tenant_id) DO NOTHING
		`
		_, _ = s.db.ExecContext(ctx, insertQuery, tenantID, profile.Name, profile.LegalName, profile.Country, profile.PayCycleStartDay)
	}
	return &profile, nil
}

func (s *companyService) UpdateCompanyProfile(ctx context.Context, tenantID uuid.UUID, p *CompanyProfile) (*CompanyProfile, error) {
	query := `
		INSERT INTO company_profiles (
			tenant_id, name, legal_name, brand_tagline, logo_url,
			cin, gstin, pan, tan, pf_code, esi_code,
			address_line1, address_line2, city, state, pincode, country,
			contact_email, contact_phone, website,
			signatory_name, signatory_title, signatory_signature_url,
			pay_cycle_start_day, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17,
			$18, $19, $20,
			$21, $22, $23,
			$24, NOW()
		)
		ON CONFLICT (tenant_id) DO UPDATE SET
			name = EXCLUDED.name,
			legal_name = EXCLUDED.legal_name,
			brand_tagline = EXCLUDED.brand_tagline,
			logo_url = EXCLUDED.logo_url,
			cin = EXCLUDED.cin,
			gstin = EXCLUDED.gstin,
			pan = EXCLUDED.pan,
			tan = EXCLUDED.tan,
			pf_code = EXCLUDED.pf_code,
			esi_code = EXCLUDED.esi_code,
			address_line1 = EXCLUDED.address_line1,
			address_line2 = EXCLUDED.address_line2,
			city = EXCLUDED.city,
			state = EXCLUDED.state,
			pincode = EXCLUDED.pincode,
			country = EXCLUDED.country,
			contact_email = EXCLUDED.contact_email,
			contact_phone = EXCLUDED.contact_phone,
			website = EXCLUDED.website,
			signatory_name = EXCLUDED.signatory_name,
			signatory_title = EXCLUDED.signatory_title,
			signatory_signature_url = EXCLUDED.signatory_signature_url,
			pay_cycle_start_day = EXCLUDED.pay_cycle_start_day,
			updated_at = NOW()
		RETURNING *
	`

	var updated CompanyProfile
	err := s.db.GetContext(ctx, &updated, query,
		tenantID, p.Name, p.LegalName, p.BrandTagline, p.LogoURL,
		p.CIN, p.GSTIN, p.PAN, p.TAN, p.PFCode, p.ESICode,
		p.AddressLine1, p.AddressLine2, p.City, p.State, p.Pincode, p.Country,
		p.ContactEmail, p.ContactPhone, p.Website,
		p.SignatoryName, p.SignatoryTitle, p.SignatorySignatureURL,
		p.PayCycleStartDay,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to save company profile: %w", err)
	}

	// Also mark tenant onboarding as completed if core fields exist
	if updated.LegalName != "" && updated.AddressLine1 != "" {
		_, _ = s.db.ExecContext(ctx, `UPDATE tenants SET onboarding_completed = TRUE WHERE id = $1`, tenantID)
	}

	return &updated, nil
}

func (s *companyService) GetSMTPConfig(ctx context.Context, tenantID uuid.UUID) (*TenantSMTPConfigResponse, error) {
	var cfg TenantSMTPConfig
	err := s.db.GetContext(ctx, &cfg, `SELECT * FROM tenant_smtp_configs WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return &TenantSMTPConfigResponse{
			Host:        "",
			Port:        587,
			Username:    "",
			HasPassword: false,
			FromEmail:   "",
			FromName:    "Humora HRMS",
			Encryption:  "starttls",
			IsVerified:  false,
		}, nil
	}

	return &TenantSMTPConfigResponse{
		Host:         cfg.Host,
		Port:         cfg.Port,
		Username:     cfg.Username,
		HasPassword:  cfg.PasswordEncrypted != "",
		FromEmail:    cfg.FromEmail,
		FromName:     cfg.FromName,
		Encryption:   cfg.Encryption,
		IsVerified:   cfg.IsVerified,
		LastTestedAt: cfg.LastTestedAt,
	}, nil
}

func (s *companyService) SaveSMTPConfig(ctx context.Context, tenantID uuid.UUID, req *SaveSMTPConfigRequest) (*TenantSMTPConfigResponse, error) {
	host := strings.TrimSpace(req.Host)
	username := strings.TrimSpace(req.Username)
	fromEmail := strings.TrimSpace(req.FromEmail)
	fromName := strings.TrimSpace(req.FromName)
	encryption := strings.TrimSpace(req.Encryption)

	if host == "" {
		return nil, errors.New("SMTP host is required")
	}
	port := req.Port
	if port <= 0 {
		port = 587
	}
	if encryption == "" {
		encryption = "starttls"
	}
	if fromName == "" {
		fromName = "Humora HRMS"
	}
	if fromEmail == "" {
		fromEmail = username
	}

	var encryptedPass string
	if req.Password != "" {
		pwd := strings.TrimSpace(req.Password)
		if strings.Contains(strings.ToLower(host), "gmail") || strings.Contains(strings.ToLower(host), "google") {
			if strings.Count(pwd, " ") == 3 && len(strings.ReplaceAll(pwd, " ", "")) == 16 {
				pwd = strings.ReplaceAll(pwd, " ", "")
			}
		}
		enc, err := encryptText(pwd)
		if err != nil {
			return nil, fmt.Errorf("failed to secure password: %w", err)
		}
		encryptedPass = enc
	} else {
		// Retain existing password if not supplied
		_ = s.db.GetContext(ctx, &encryptedPass, `SELECT password_encrypted FROM tenant_smtp_configs WHERE tenant_id = $1`, tenantID)
	}

	query := `
		INSERT INTO tenant_smtp_configs (
			tenant_id, host, port, username, password_encrypted,
			from_email, from_name, encryption, is_verified, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW())
		ON CONFLICT (tenant_id) DO UPDATE SET
			host = EXCLUDED.host,
			port = EXCLUDED.port,
			username = EXCLUDED.username,
			password_encrypted = CASE WHEN EXCLUDED.password_encrypted != '' THEN EXCLUDED.password_encrypted ELSE tenant_smtp_configs.password_encrypted END,
			from_email = EXCLUDED.from_email,
			from_name = EXCLUDED.from_name,
			encryption = EXCLUDED.encryption,
			updated_at = NOW()
	`

	_, err := s.db.ExecContext(ctx, query,
		tenantID, host, port, username, encryptedPass,
		fromEmail, fromName, encryption,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to save SMTP settings: %w", err)
	}

	return s.GetSMTPConfig(ctx, tenantID)
}

func (s *companyService) TestSMTPConfig(ctx context.Context, tenantID uuid.UUID, req *TestSMTPRequest) error {
	var mailerCfg *mailer.SMTPConfig

	// 1. If explicit credentials were provided in the test payload, prioritize them
	if req != nil && strings.TrimSpace(req.Host) != "" {
		host := strings.TrimSpace(req.Host)
		username := strings.TrimSpace(req.Username)
		password := strings.TrimSpace(req.Password)
		fromEmail := strings.TrimSpace(req.FromEmail)
		fromName := strings.TrimSpace(req.FromName)
		encryption := strings.TrimSpace(req.Encryption)
		port := req.Port

		if encryption == "" {
			encryption = "starttls"
		}
		if port <= 0 {
			if strings.EqualFold(encryption, "ssl") {
				port = 465
			} else {
				port = 587
			}
		}
		if fromEmail == "" {
			fromEmail = username
		}
		if fromName == "" {
			fromName = "Humora HRMS"
		}

		// If password is not in the request, try to load existing encrypted password from DB
		if password == "" {
			var encPass string
			_ = s.db.GetContext(ctx, &encPass, `SELECT password_encrypted FROM tenant_smtp_configs WHERE tenant_id = $1`, tenantID)
			if encPass != "" {
				if dec, err := decryptText(encPass); err == nil {
					password = dec
				}
			}
		}

		// Normalize Google App Password if needed
		if strings.Contains(strings.ToLower(host), "gmail") || strings.Contains(strings.ToLower(host), "google") {
			if strings.Count(password, " ") == 3 && len(strings.ReplaceAll(password, " ", "")) == 16 {
				password = strings.ReplaceAll(password, " ", "")
			}
		}

		mailerCfg = &mailer.SMTPConfig{
			Host:       host,
			Port:       port,
			Username:   username,
			Password:   password,
			FromEmail:  fromEmail,
			FromName:   fromName,
			Encryption: encryption,
		}
	} else {
		// 2. Otherwise load saved active configuration from DB
		dbCfg, err := s.GetActiveMailerConfig(ctx, tenantID)
		if err != nil {
			return err
		}
		mailerCfg = dbCfg
	}

	if mailerCfg == nil || mailerCfg.Host == "" {
		return errors.New("no SMTP gateway configured. Please enter your SMTP details or save them first")
	}

	recipient := ""
	if req != nil {
		recipient = strings.TrimSpace(req.RecipientEmail)
	}
	if recipient == "" {
		recipient = mailerCfg.FromEmail
	}
	if recipient == "" {
		recipient = mailerCfg.Username
	}

	testErr := mailer.SendTestEmail(mailerCfg, recipient)
	if testErr != nil {
		return fmt.Errorf("SMTP test failed: %w", testErr)
	}

	// Mark verified in DB
	_, _ = s.db.ExecContext(ctx, `
		UPDATE tenant_smtp_configs
		SET is_verified = TRUE, last_tested_at = NOW()
		WHERE tenant_id = $1
	`, tenantID)

	return nil
}

func (s *companyService) GetActiveMailerConfig(ctx context.Context, tenantID uuid.UUID) (*mailer.SMTPConfig, error) {
	var cfg TenantSMTPConfig
	err := s.db.GetContext(ctx, &cfg, `SELECT * FROM tenant_smtp_configs WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, nil // No config found
	}

	plainPass, err := decryptText(cfg.PasswordEncrypted)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt SMTP credentials: %w", err)
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
