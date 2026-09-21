-- Migration: Automated Payroll & Compensation Engine
-- Tables: hrms_payroll_runs, hrms_payslips, hrms_it_declarations, hrms_reimbursement_claims

-- 1. Monthly Payroll Runs (Company-wide execution batches)
CREATE TABLE IF NOT EXISTS hrms_payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    month INT NOT NULL,
    year INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'processing', 'completed'
    total_employees INT NOT NULL DEFAULT 0,
    total_gross NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
    total_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
    total_net NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year)
);

-- 2. Official Monthly Payslips (Individual itemized breakdown)
CREATE TABLE IF NOT EXISTS hrms_payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payroll_run_id UUID REFERENCES hrms_payroll_runs(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    month INT NOT NULL,
    year INT NOT NULL,
    pay_period VARCHAR(50) NOT NULL,
    payment_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'paid', -- 'paid', 'processing', 'hold'
    total_days INT NOT NULL,
    payable_days NUMERIC(5, 2) NOT NULL,
    lop_days NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    -- Itemized Earnings
    basic NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    hra NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    conveyance NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    medical_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    special_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    bonus NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    gross_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    -- Itemized Deductions
    provident_fund NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    professional_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    tds NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    lop_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    -- Net Pay
    net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    net_pay_in_words VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, employee_id, month, year)
);

-- 3. Income Tax Declarations & Regime Planner
CREATE TABLE IF NOT EXISTS hrms_it_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    financial_year VARCHAR(20) NOT NULL,
    regime VARCHAR(10) NOT NULL DEFAULT 'new', -- 'new', 'old'
    sec_80c_total NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    sec_80d_health_insurance NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    sec_80d_parents NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    hra_annual_rent_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    hra_landlord_pan VARCHAR(20),
    home_loan_interest NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    nps_contribution NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    projected_annual_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    monthly_tds NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, employee_id, financial_year)
);

-- 4. Reimbursement / Expense Claims (Flexible Benefit Plan)
CREATE TABLE IF NOT EXISTS hrms_reimbursement_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    bill_number VARCHAR(100),
    bill_date DATE NOT NULL,
    merchant_name VARCHAR(150) NOT NULL,
    description TEXT,
    receipt_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'reimbursed'
    reviewer_name VARCHAR(150),
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high query performance
CREATE INDEX IF NOT EXISTS idx_hrms_payroll_runs_tenant ON hrms_payroll_runs(tenant_id, year, month);
CREATE INDEX IF NOT EXISTS idx_hrms_payslips_emp ON hrms_payslips(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_hrms_payslips_run ON hrms_payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_hrms_it_decl_emp ON hrms_it_declarations(employee_id, financial_year);
CREATE INDEX IF NOT EXISTS idx_hrms_reimb_emp ON hrms_reimbursement_claims(employee_id, status);

-- Seed Baseline Compensation Structures if missing
DO $$
DECLARE
    emp_rec RECORD;
BEGIN
    FOR emp_rec IN 
        SELECT id, tenant_id FROM hrms_employees 
        WHERE id NOT IN (SELECT employee_id FROM hrms_compensation_structures)
    LOOP
        INSERT INTO hrms_compensation_structures (
            tenant_id, employee_id, basic, hra, special_allowance, 
            provident_fund, professional_tax, effective_date
        ) VALUES (
            emp_rec.tenant_id, emp_rec.id, 65000.00, 32500.00, 25000.00, 
            7800.00, 200.00, CURRENT_DATE
        );
    END LOOP;
END $$;
