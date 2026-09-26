-- Migration: Candidate Payable & Compensation Structure for Onboarding Flow
-- Date: 2026-09-24

ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS annual_ctc NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS monthly_gross NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS hra NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS special_allowance NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS provident_fund NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS professional_tax NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS net_payable NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'bank_transfer';
ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
