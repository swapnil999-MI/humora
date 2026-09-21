# 03. Complete Database Schema & Data Models

Humora uses a unified PostgreSQL 16+ schema with strict relational integrity, Row-Level Security (RLS) for multi-tenancy, high-performance JSONB indexing for dynamic custom fields, and an append-only cryptographic audit ledger.

---

## Complete Table Map

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       TENANTS & IDENTITY CORE                                    │
│   • tenants                           • users                             • roles                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                       ZOHO PEOPLE HRMS ENGINE                                    │
│   • hrms_departments                  • hrms_designations                 • hrms_employees       │
│   • hrms_custom_form_definitions      • hrms_employee_subforms            • hrms_assets          │
│   • hrms_documents                    • hrms_hr_letter_templates          • hrms_social_posts    │
│   • hrms_office_locations             • hrms_shifts                       • hrms_shift_rosters   │
│   • hrms_attendance_punches           • hrms_attendance_regularizations   • hrms_leave_types     │
│   • hrms_leave_balances               • hrms_leave_requests               • hrms_holidays        │
│   • hrms_timesheet_entries            • hrms_travel_requests              • hrms_expense_claims  │
│   • hrms_helpdesk_tickets             • hrms_okr_objectives               • hrms_okr_key_results │
│   • hrms_performance_reviews          • hrms_onboarding_checklists        • hrms_exit_clearances │
│   • hrms_compensation_structures      • hrms_payroll_lop_cycles                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                       JIRA WORK MANAGEMENT ENGINE                                │
│   • jira_workflows                    • jira_workflow_statuses            • jira_workflow_trans  │
│   • jira_projects                     • jira_sprints                      • jira_issues          │
│   • jira_issue_links                  • jira_worklogs                     • jira_sla_policies    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                       AUDIT & AUTOMATIONS LEDGER                                 │
│   • audit_ledger (SHA-256 hash-chained)                                   • cel_automation_rules │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Multi-Tenancy & Identity Layer

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Multi-Tenant Organizations
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'enterprise',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Credentials & Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'invited', 'suspended'
    device_public_key TEXT, -- Ed25519 public key for mobile offline punch verification
    presence_status VARCHAR(50) NOT NULL DEFAULT 'offline', -- 'offline', 'in_office_active', 'on_leave'
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

-- Roles & Granular Permissions
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
```

---

## 2. Core HRMS: Employees, Dynamic Forms & Assets

```sql
-- Departments
CREATE TABLE hrms_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    lead_id UUID, -- References hrms_employees(id)
    parent_id UUID REFERENCES hrms_departments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

-- Designations / Job Titles
CREATE TABLE hrms_designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    grade_level VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, title)
);

-- Employees (The Single Core Persona for HR and Jira)
CREATE TABLE hrms_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    employee_code VARCHAR(50) NOT NULL, -- 'EMP-001'
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    work_email VARCHAR(255) NOT NULL,
    personal_email VARCHAR(255),
    phone VARCHAR(50),
    department_id UUID REFERENCES hrms_departments(id),
    designation_id UUID REFERENCES hrms_designations(id),
    manager_id UUID REFERENCES hrms_employees(id), -- Primary Administrative Reporting
    secondary_manager_id UUID REFERENCES hrms_employees(id), -- Functional / Matrix Reporting
    date_of_joining DATE NOT NULL,
    date_of_exit DATE,
    employment_type VARCHAR(50) NOT NULL DEFAULT 'full_time',
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'probation', 'notice_period', 'exited'
    hourly_cost_rate NUMERIC(10, 2) DEFAULT 0.00, -- Used for Project P&L and labor costing
    custom_profile_fields JSONB DEFAULT '{}'::jsonb, -- Dynamic fields
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31 23:59:59Z',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, employee_code),
    UNIQUE (tenant_id, work_email)
);

-- Nested Sub-Forms (Education, Previous Experience, Certifications)
CREATE TABLE hrms_employee_subforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    subform_name VARCHAR(100) NOT NULL, -- 'education', 'previous_jobs', 'certifications'
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset Management & Custody
CREATE TABLE hrms_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'Laptop', 'Monitor', 'Mobile', 'ID Card'
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    allocated_to UUID REFERENCES hrms_employees(id) ON DELETE SET NULL,
    allocation_date DATE,
    condition VARCHAR(50) NOT NULL DEFAULT 'new', -- 'new', 'good', 'damaged'
    status VARCHAR(50) NOT NULL DEFAULT 'allocated', -- 'available', 'allocated', 'in_repair', 'scrapped'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dynamic HR Letters & Templates
CREATE TABLE hrms_hr_letter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    letter_type VARCHAR(100) NOT NULL, -- 'offer_letter', 'relieving_letter', 'experience_letter'
    title VARCHAR(200) NOT NULL,
    html_template TEXT NOT NULL, -- Contains {{employee.name}}, {{compensation.ctc}}, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Time, Geofenced Attendance & Shift Rosters

```sql
-- Geofenced Office Locations
CREATE TABLE hrms_office_locations (
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
CREATE TABLE hrms_shifts (
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
CREATE TABLE hrms_shift_rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES hrms_shifts(id),
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, effective_date)
);

-- Attendance Punches (Geofenced, Biometric, Offline-Signed)
CREATE TABLE hrms_attendance_punches (
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
    source VARCHAR(50) NOT NULL DEFAULT 'web', -- 'web', 'android', 'ios', 'biometric'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendance Regularizations & OD/WFH Requests
CREATE TABLE hrms_attendance_regularizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL, -- 'missed_punch', 'on_duty', 'work_from_home'
    request_date DATE NOT NULL,
    requested_punch_in TIMESTAMPTZ,
    requested_punch_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by UUID REFERENCES hrms_employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Leaves, Absences & Holidays

```sql
-- Leave Types
CREATE TABLE hrms_leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL, -- 'PL', 'SL', 'CL', 'ML', 'LOP'
    annual_quota NUMERIC(5, 2) NOT NULL DEFAULT 12.0,
    accrual_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    is_carry_forward BOOLEAN NOT NULL DEFAULT TRUE,
    max_carry_forward NUMERIC(5, 2) DEFAULT 10.0,
    is_sandwich_rule_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

-- Public Holidays
CREATE TABLE hrms_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    holiday_date DATE NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, holiday_date)
);

-- Leave Balances
CREATE TABLE hrms_leave_balances (
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
CREATE TABLE hrms_leave_requests (
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
```

---

## 5. Travel, Expense Desk & HR Helpdesk

```sql
-- Travel Requests
CREATE TABLE hrms_travel_requests (
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
CREATE TABLE hrms_expense_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    travel_request_id UUID REFERENCES hrms_travel_requests(id),
    category VARCHAR(100) NOT NULL, -- 'Flight', 'Hotel', 'Meals', 'Mileage'
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    receipt_url TEXT,
    receipt_sha256 VARCHAR(64), -- Cryptographic hash to prevent duplicate reimbursement
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Internal HR Helpdesk Cases
CREATE TABLE hrms_helpdesk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ticket_number SERIAL,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL, -- 'Payroll', 'Benefits', 'IT', 'Admin', 'Policy'
    subject VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    assigned_hr_id UUID REFERENCES hrms_employees(id),
    sla_due_at TIMESTAMPTZ,
    csat_score INT, -- 1 to 5
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Performance (PMS) & Lifecycle Management

```sql
-- Cascading OKRs
CREATE TABLE hrms_okr_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    parent_objective_id UUID REFERENCES hrms_okr_objectives(id),
    owner_id UUID NOT NULL REFERENCES hrms_employees(id),
    level VARCHAR(50) NOT NULL DEFAULT 'individual', -- 'company', 'department', 'team', 'individual'
    quarter VARCHAR(10) NOT NULL, -- 'Q1-2026'
    progress_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hrms_okr_key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id UUID NOT NULL REFERENCES hrms_okr_objectives(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'number', 'percentage', 'currency'
    start_value NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    target_value NUMERIC(12, 2) NOT NULL,
    current_value NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    weightage NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exit Clearance (NOC)
CREATE TABLE hrms_exit_clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL, -- 'IT', 'Finance', 'Admin', 'HR'
    is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
    cleared_by UUID REFERENCES hrms_employees(id),
    cleared_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, department)
);

-- Compensation CTC Structures & Loss of Pay (LOP) Cycles
CREATE TABLE hrms_compensation_structures (
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

CREATE TABLE hrms_payroll_lop_cycles (
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
```

---

## 7. Jira Work Management Core

```sql
-- Workflows & Statuses
CREATE TABLE jira_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE jira_workflow_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES jira_workflows(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'todo', 'in_progress', 'done'
    position INT NOT NULL DEFAULT 0
);

-- Projects
CREATE TABLE jira_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(10) NOT NULL, -- 'HUM', 'PAY'
    name VARCHAR(255) NOT NULL,
    lead_id UUID NOT NULL REFERENCES hrms_employees(id),
    workflow_id UUID NOT NULL REFERENCES jira_workflows(id),
    project_type VARCHAR(50) NOT NULL DEFAULT 'scrum',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, key)
);

-- Sprints (Integrated with HR Capacity)
CREATE TABLE jira_sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    goal TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'future',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    calculated_capacity_hours NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Issues
CREATE TABLE jira_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    issue_number INT NOT NULL,
    issue_key VARCHAR(25) NOT NULL,
    parent_id UUID REFERENCES jira_issues(id),
    sprint_id UUID REFERENCES jira_sprints(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    issue_type VARCHAR(50) NOT NULL, -- 'epic', 'story', 'task', 'bug', 'subtask'
    status_id UUID NOT NULL REFERENCES jira_workflow_statuses(id),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    assignee_id UUID REFERENCES hrms_employees(id),
    reporter_id UUID NOT NULL REFERENCES hrms_employees(id),
    story_points INT,
    original_estimate_seconds INT DEFAULT 0,
    remaining_estimate_seconds INT DEFAULT 0,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, issue_number)
);

-- Worklogs (Dual link to Jira Issue and HR Timesheet)
CREATE TABLE jira_worklogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    time_spent_seconds INT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    is_billable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 8. Cryptographic Tamper-Evident Audit Ledger

```sql
CREATE TABLE audit_ledger (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    changed_by UUID REFERENCES users(id),
    previous_state JSONB,
    new_state JSONB,
    previous_block_hash VARCHAR(64) NOT NULL,
    current_block_hash VARCHAR(64) NOT NULL, -- SHA-256(id + prev_hash + data + timestamp)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_ledger_chain ON audit_ledger (tenant_id, entity_name, entity_id);
```
