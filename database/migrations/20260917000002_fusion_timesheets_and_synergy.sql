-- Migration: Cross-Domain Synergy Engines (Timesheet Submissions & Hourly Rates)
-- Tables: hrms_timesheet_submissions

CREATE TABLE IF NOT EXISTS hrms_timesheet_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    total_clocked_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
    total_logged_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
    variance_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'submitted', -- 'draft', 'submitted', 'approved', 'rejected'
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    reviewer_comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, employee_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_timesheet_sub_emp ON hrms_timesheet_submissions(employee_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_sub_tenant ON hrms_timesheet_submissions(tenant_id, status);

-- Seed realistic hourly cost rates if 0
UPDATE hrms_employees 
SET hourly_cost_rate = 75.00 
WHERE (hourly_cost_rate IS NULL OR hourly_cost_rate = 0.00) AND (work_email = 'founder@acme.io' OR work_email = 'alice.smith@humora.internal');

UPDATE hrms_employees 
SET hourly_cost_rate = 65.00 
WHERE (hourly_cost_rate IS NULL OR hourly_cost_rate = 0.00) AND work_email = 'marcus.vance@acme.io';
