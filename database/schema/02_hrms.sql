-- Departments
CREATE TABLE IF NOT EXISTS hrms_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    lead_id UUID,
    parent_id UUID REFERENCES hrms_departments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

-- Designations / Job Titles
CREATE TABLE IF NOT EXISTS hrms_designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    grade_level VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, title)
);

-- Employees Core
CREATE TABLE IF NOT EXISTS hrms_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    work_email VARCHAR(255) NOT NULL,
    personal_email VARCHAR(255),
    phone VARCHAR(50),
    department_id UUID REFERENCES hrms_departments(id),
    designation_id UUID REFERENCES hrms_designations(id),
    manager_id UUID REFERENCES hrms_employees(id),
    secondary_manager_id UUID REFERENCES hrms_employees(id),
    date_of_joining DATE NOT NULL,
    date_of_exit DATE,
    employment_type VARCHAR(50) NOT NULL DEFAULT 'full_time',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    hourly_cost_rate NUMERIC(10, 2) DEFAULT 0.00,
    custom_profile_fields JSONB DEFAULT '{}'::jsonb,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31 23:59:59Z',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, employee_code),
    UNIQUE (tenant_id, work_email)
);

-- Nested Sub-Forms (Education, Previous Jobs, Certifications)
CREATE TABLE IF NOT EXISTS hrms_employee_subforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    subform_name VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset Management & Custody
CREATE TABLE IF NOT EXISTS hrms_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    allocated_to UUID REFERENCES hrms_employees(id) ON DELETE SET NULL,
    allocation_date DATE,
    condition VARCHAR(50) NOT NULL DEFAULT 'new',
    status VARCHAR(50) NOT NULL DEFAULT 'allocated',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dynamic HR Letters & Templates
CREATE TABLE IF NOT EXISTS hrms_hr_letter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    letter_type VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    html_template TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Geofenced Office Locations
CREATE TABLE IF NOT EXISTS hrms_office_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    radius_meters INT NOT NULL DEFAULT 100,
    polygon_coordinates JSONB,
    allowed_ip_ranges TEXT[],
    allowed_wifi_bssid TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shift Definitions
CREATE TABLE IF NOT EXISTS hrms_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INT NOT NULL DEFAULT 15,
    half_day_hours NUMERIC(4, 2) NOT NULL DEFAULT 4.5,
    full_day_hours NUMERIC(4, 2) NOT NULL DEFAULT 8.0,
    is_night_shift BOOLEAN NOT NULL DEFAULT FALSE,
    night_shift_allowance NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shift Rosters & Swaps
CREATE TABLE IF NOT EXISTS hrms_shift_rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES hrms_shifts(id),
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, effective_date)
);

-- Attendance Punches
CREATE TABLE IF NOT EXISTS hrms_attendance_punches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    punch_type VARCHAR(20) NOT NULL, -- 'in', 'out', 'break_start', 'break_end'
    punched_at TIMESTAMPTZ NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    accuracy_meters NUMERIC(6, 2),
    location_id UUID REFERENCES hrms_office_locations(id),
    is_geofence_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_offline_signed BOOLEAN NOT NULL DEFAULT FALSE,
    offline_signature TEXT,
    device_info JSONB,
    source VARCHAR(50) NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendance Regularizations & OD/WFH Requests
CREATE TABLE IF NOT EXISTS hrms_attendance_regularizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL,
    request_date DATE NOT NULL,
    requested_punch_in TIMESTAMPTZ,
    requested_punch_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES hrms_employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leave Types
CREATE TABLE IF NOT EXISTS hrms_leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    annual_quota NUMERIC(5, 2) NOT NULL DEFAULT 12.0,
    accrual_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    is_carry_forward BOOLEAN NOT NULL DEFAULT TRUE,
    max_carry_forward NUMERIC(5, 2) DEFAULT 10.0,
    is_sandwich_rule_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

-- Public Holidays
CREATE TABLE IF NOT EXISTS hrms_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    holiday_date DATE NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, holiday_date)
);

-- Leave Balances
CREATE TABLE IF NOT EXISTS hrms_leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES hrms_leave_types(id) ON DELETE CASCADE,
    balance NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    credited NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    used NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    year INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, leave_type_id, year)
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS hrms_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES hrms_leave_types(id),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    total_days NUMERIC(5, 2) NOT NULL,
    sandwich_days_added NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_approval_level INT NOT NULL DEFAULT 1,
    approved_by UUID REFERENCES hrms_employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Travel Requests
CREATE TABLE IF NOT EXISTS hrms_travel_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    destination VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    purpose TEXT NOT NULL,
    advance_amount_requested NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expense Claims
CREATE TABLE IF NOT EXISTS hrms_expense_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    travel_request_id UUID REFERENCES hrms_travel_requests(id),
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    receipt_url TEXT,
    receipt_sha256 VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Internal HR Helpdesk Tickets
CREATE TABLE IF NOT EXISTS hrms_helpdesk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ticket_number SERIAL,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    subject VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    assigned_hr_id UUID REFERENCES hrms_employees(id),
    sla_due_at TIMESTAMPTZ,
    csat_score INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cascading OKRs
CREATE TABLE IF NOT EXISTS hrms_okr_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    parent_objective_id UUID REFERENCES hrms_okr_objectives(id),
    owner_id UUID NOT NULL REFERENCES hrms_employees(id),
    level VARCHAR(50) NOT NULL DEFAULT 'individual',
    quarter VARCHAR(10) NOT NULL,
    progress_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms_okr_key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id UUID NOT NULL REFERENCES hrms_okr_objectives(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    start_value NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    target_value NUMERIC(12, 2) NOT NULL,
    current_value NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    weightage NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exit Clearance (NOC)
CREATE TABLE IF NOT EXISTS hrms_exit_clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL,
    is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
    cleared_by UUID REFERENCES hrms_employees(id),
    cleared_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, department)
);

-- Compensation CTC Structures & Loss of Pay (LOP) Cycles
CREATE TABLE IF NOT EXISTS hrms_compensation_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    basic NUMERIC(12, 2) NOT NULL,
    hra NUMERIC(12, 2) NOT NULL,
    special_allowance NUMERIC(12, 2) NOT NULL,
    provident_fund NUMERIC(12, 2) NOT NULL,
    professional_tax NUMERIC(12, 2) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms_payroll_lop_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    month INT NOT NULL,
    year INT NOT NULL,
    total_working_days NUMERIC(4, 2) NOT NULL,
    lop_days NUMERIC(4, 2) NOT NULL DEFAULT 0.0,
    payable_days NUMERIC(4, 2) NOT NULL,
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, month, year)
);

-- HRMS Timesheet Entries (Dual Synced with Work Worklogs)
CREATE TABLE IF NOT EXISTS hrms_timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    hours_logged NUMERIC(5, 2) NOT NULL,
    description TEXT,
    cost_center VARCHAR(100),
    is_billable BOOLEAN NOT NULL DEFAULT TRUE,
    work_issue_id UUID,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hrms_emp_tenant ON hrms_employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hrms_attendance_emp_date ON hrms_attendance_punches(employee_id, punched_at);
CREATE INDEX IF NOT EXISTS idx_hrms_leave_req_emp ON hrms_leave_requests(employee_id, from_date, to_date);
