-- Migration: Onboarding Candidates and Employee Profiles
-- Date: 2026-09-16

CREATE TABLE IF NOT EXISTS hrms_onboarding_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    personal_email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    department_id UUID REFERENCES hrms_departments(id),
    designation_id UUID REFERENCES hrms_designations(id),
    manager_id UUID REFERENCES hrms_employees(id),
    expected_joining_date DATE NOT NULL,
    employment_type VARCHAR(50) NOT NULL DEFAULT 'full_time',
    hourly_cost_rate NUMERIC(10, 2) DEFAULT 0.00,
    invite_token VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'invited',
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms_candidate_dossiers (
    candidate_id UUID PRIMARY KEY REFERENCES hrms_onboarding_candidates(id) ON DELETE CASCADE,
    personal_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    emergency_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
    bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    education_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    policy_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms_employee_subforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    subform_name VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, subform_name)
);

CREATE INDEX IF NOT EXISTS idx_hrms_onboarding_tenant ON hrms_onboarding_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hrms_onboarding_token ON hrms_onboarding_candidates(invite_token);
CREATE INDEX IF NOT EXISTS idx_hrms_onboarding_status ON hrms_onboarding_candidates(status);
