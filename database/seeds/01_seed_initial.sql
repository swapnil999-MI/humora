-- Seed Initial Enterprise Setup for Humora Platform

-- 1. Default Organization / Tenant
INSERT INTO tenants (id, slug, name, domain, subscription_tier)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'humora-corp',
    'Humora Enterprise Inc.',
    'humora.internal',
    'enterprise'
) ON CONFLICT (id) DO NOTHING;

-- 2. Default Roles
INSERT INTO roles (id, tenant_id, name, permissions)
VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'superadmin',
    '["*"]'::jsonb
),
(
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'hr_admin',
    '["hrms:*", "work:read"]'::jsonb
),
(
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'project_lead',
    '["work:*", "hrms:read"]'::jsonb
),
(
    'b0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'employee',
    '["hrms:self", "work:self"]'::jsonb
) ON CONFLICT (tenant_id, name) DO NOTHING;

-- 3. Default Admin User (Password: Password@123)
-- Argon2id hash for Password@123
INSERT INTO users (id, tenant_id, email, password_hash, status, presence_status)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'admin@humora.internal',
    '$argon2id$v=19$m=65536,t=3,p=2$2rJq22bZ34vYk93Kk0l7nA$OaZ9R11WvT2sTqPzV8K7LqO0m9U7Yx4BvW5E2R1T4Y',
    'active',
    'in_office_active'
) ON CONFLICT (tenant_id, email) DO NOTHING;

-- 4. Default Departments
INSERT INTO hrms_departments (id, tenant_id, name)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Engineering'),
    ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Product & Design'),
    ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Human Resources'),
    ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Finance')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 5. Default Designations
INSERT INTO hrms_designations (id, tenant_id, title, grade_level)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Head of Engineering', 'L7'),
    ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Principal Engineer', 'L6'),
    ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Staff Software Engineer', 'L5'),
    ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Senior Product Manager', 'L5')
ON CONFLICT (tenant_id, title) DO NOTHING;

-- 6. Default Office Location (Bangalore HQ)
INSERT INTO hrms_office_locations (id, tenant_id, name, latitude, longitude, radius_meters, allowed_wifi_bssid)
VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Bangalore Tech Park HQ',
    12.9715987,
    77.5945627,
    200,
    ARRAY['00:14:22:01:23:45', 'c8:3a:35:12:34:56']
) ON CONFLICT DO NOTHING;

-- 7. Default Shift
INSERT INTO hrms_shifts (id, tenant_id, name, start_time, end_time, grace_minutes, half_day_hours, full_day_hours)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'General Shift',
    '09:00:00',
    '18:00:00',
    15,
    4.5,
    8.0
) ON CONFLICT DO NOTHING;

-- 8. Default Leave Types (with Sandwich Rule enabled)
INSERT INTO hrms_leave_types (id, tenant_id, name, code, annual_quota, accrual_frequency, is_carry_forward, max_carry_forward, is_sandwich_rule_enabled)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Privilege Leave', 'PL', 18.0, 'monthly', TRUE, 12.0, TRUE),
    ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Sick Leave', 'SL', 12.0, 'monthly', FALSE, 0.0, FALSE),
    ('20000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Casual Leave', 'CL', 8.0, 'monthly', FALSE, 0.0, TRUE)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 9. Default Work Workflow & Statuses
INSERT INTO work_workflows (id, tenant_id, name, description)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Standard Agile Workflow',
    'Standard 4-stage Kanban/Scrum agile workflow'
) ON CONFLICT DO NOTHING;

INSERT INTO work_workflow_statuses (id, workflow_id, name, category, position)
VALUES
    ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'To Do', 'todo', 0),
    ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'In Progress', 'in_progress', 1),
    ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'In Review', 'in_progress', 2),
    ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'Done', 'done', 3)
ON CONFLICT DO NOTHING;
