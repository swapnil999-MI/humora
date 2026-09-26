-- Migration: 20260923000002_company_profile_and_smtp_gateway.sql
-- Description: Adds mandatory company profiles, tenant SMTP gateway configs, and password reset OTPs

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Company Profiles (Statutory, Tax, Physical Address, and Signatory Details)
CREATE TABLE IF NOT EXISTS company_profiles (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    legal_name VARCHAR(255) NOT NULL DEFAULT '',
    brand_tagline VARCHAR(255) NOT NULL DEFAULT '',
    logo_url TEXT,
    cin VARCHAR(50) NOT NULL DEFAULT '',
    gstin VARCHAR(50) NOT NULL DEFAULT '',
    pan VARCHAR(50) NOT NULL DEFAULT '',
    tan VARCHAR(50) NOT NULL DEFAULT '',
    pf_code VARCHAR(50) NOT NULL DEFAULT '',
    esi_code VARCHAR(50) NOT NULL DEFAULT '',
    address_line1 TEXT NOT NULL DEFAULT '',
    address_line2 TEXT NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT '',
    state VARCHAR(100) NOT NULL DEFAULT '',
    pincode VARCHAR(20) NOT NULL DEFAULT '',
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    contact_email VARCHAR(255) NOT NULL DEFAULT '',
    contact_phone VARCHAR(50) NOT NULL DEFAULT '',
    website VARCHAR(255) NOT NULL DEFAULT '',
    signatory_name VARCHAR(255) NOT NULL DEFAULT '',
    signatory_title VARCHAR(255) NOT NULL DEFAULT '',
    signatory_signature_url TEXT,
    pay_cycle_start_day INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant SMTP Gateway Settings
CREATE TABLE IF NOT EXISTS tenant_smtp_configs (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL DEFAULT 587,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255) NOT NULL DEFAULT 'Humora HRMS',
    encryption VARCHAR(20) NOT NULL DEFAULT 'starttls', -- 'starttls', 'ssl', 'none'
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Password Reset OTP Verification
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_otps(email, used);

-- Seed initial company profile from existing tenants
INSERT INTO company_profiles (tenant_id, name, legal_name, country, pay_cycle_start_day, created_at, updated_at)
SELECT id, name, name, 'India', 1, NOW(), NOW()
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
