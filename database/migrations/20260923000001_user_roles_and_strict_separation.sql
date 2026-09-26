-- Migration: 20260923000001_user_roles_and_strict_separation.sql
-- Description: Establishes explicit user_roles mapping table and decouples admin from HRMS employees

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Ensure default roles exist for every tenant
INSERT INTO roles (id, tenant_id, name, permissions, created_at)
SELECT gen_random_uuid(), t.id, 'superadmin', '["*"]'::jsonb, NOW()
FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO roles (id, tenant_id, name, permissions, created_at)
SELECT gen_random_uuid(), t.id, 'employee', '["hrms:self", "work:self"]'::jsonb, NOW()
FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO roles (id, tenant_id, name, permissions, created_at)
SELECT gen_random_uuid(), t.id, 'hr_admin', '["hrms:*", "work:read"]'::jsonb, NOW()
FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Assign superadmin role to admin users
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON u.tenant_id = r.tenant_id AND r.name = 'superadmin'
WHERE u.email IN ('admin@humora.internal', 'founder@acme.io')
ON CONFLICT DO NOTHING;

-- Assign employee role to Marcus
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON u.tenant_id = r.tenant_id AND r.name = 'employee'
WHERE u.email = 'marcus@gamil.com'
ON CONFLICT DO NOTHING;

-- Decouple admin users from hrms_employees (admin must NOT have an employee persona)
DELETE FROM hrms_employees
WHERE work_email = 'admin@humora.internal'
   OR user_id IN (SELECT id FROM users WHERE email = 'admin@humora.internal');
