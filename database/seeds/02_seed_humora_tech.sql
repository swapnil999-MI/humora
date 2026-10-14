-- Seed Humora Technologies Admin and 2 Reporting Employees
DO $$
DECLARE
    v_tenant_id UUID := '5f61bd40-5757-451a-9bb4-5cd41bb48cbd';
    v_superadmin_role_id UUID := 'f04cceab-5484-41fe-95ee-4ee363a7e819';
    v_admin_role_id UUID := '32e06d73-84bb-4e12-87ad-20c1dbfe5966';
    v_employee_role_id UUID := '84646405-0333-4cc5-b8da-1329d4585568';
    
    v_eng_dept_id UUID := 'e9aadce1-5620-469c-b4ee-6fc4936f1b11';
    v_design_dept_id UUID := 'bdb8c3b2-c9c4-4271-b222-87b8f0b7debb';

    v_pl_leave_id UUID := '903bcf45-dc68-4189-9031-a17a64b06c45';
    v_sl_leave_id UUID := '3d1b2989-2e06-4035-a84f-b7cfe21f46d3';
    v_cl_leave_id UUID := 'c096ee91-58d0-43b0-8035-d02ddbac2635';

    -- Password@123 argon2id hash
    v_pwd_hash TEXT := '$argon2id$v=19$m=65536,t=3,p=2$SmCWH7xJ8yoXVlQNOI7vdg$hm8xqZUh3iiim7HfzXncnbaP2IGsRVb9pzKUP/FMaHE';

    v_admin_user_id UUID := 'c0000000-0000-0000-0000-000000000010';
    v_admin_emp_id UUID := 'e1000000-0000-0000-0000-000000000010';

    v_emp1_user_id UUID := 'c0000000-0000-0000-0000-000000000011';
    v_emp1_emp_id UUID := 'e1000000-0000-0000-0000-000000000011';

    v_emp2_user_id UUID := 'c0000000-0000-0000-0000-000000000012';
    v_emp2_emp_id UUID := 'e1000000-0000-0000-0000-000000000012';
BEGIN
    -- 1. Update Tenant Name
    UPDATE tenants
    SET name = 'Humora Technologies'
    WHERE id = v_tenant_id;

    -- 2. Create Admin User: Humora Technologies
    INSERT INTO users (id, tenant_id, email, password_hash, status, presence_status)
    VALUES (v_admin_user_id, v_tenant_id, 'admin@humoratechnologies.com', v_pwd_hash, 'active', 'in_office_active')
    ON CONFLICT (tenant_id, email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash, status = 'active';

    -- Assign Superadmin & Admin Roles
    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_admin_user_id, v_superadmin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_admin_user_id, v_admin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Insert Admin Employee Profile
    INSERT INTO hrms_employees (
        id, tenant_id, user_id, employee_code, first_name, last_name, work_email,
        department_id, date_of_joining, employment_type, status
    ) VALUES (
        v_admin_emp_id, v_tenant_id, v_admin_user_id, 'ADM-001', 'Humora', 'Technologies',
        'admin@humoratechnologies.com', v_eng_dept_id, '2024-01-01', 'full_time', 'active'
    ) ON CONFLICT (tenant_id, employee_code) DO UPDATE
    SET first_name = 'Humora', last_name = 'Technologies', work_email = 'admin@humoratechnologies.com', user_id = v_admin_user_id;

    -- 3. Create Employee 1: Rahul Sharma (Reports to Humora Technologies)
    INSERT INTO users (id, tenant_id, email, password_hash, status, presence_status)
    VALUES (v_emp1_user_id, v_tenant_id, 'rahul.sharma@humoratechnologies.com', v_pwd_hash, 'active', 'in_office_active')
    ON CONFLICT (tenant_id, email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash, status = 'active';

    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_emp1_user_id, v_employee_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    INSERT INTO hrms_employees (
        id, tenant_id, user_id, employee_code, first_name, last_name, work_email,
        department_id, manager_id, date_of_joining, employment_type, status
    ) VALUES (
        v_emp1_emp_id, v_tenant_id, v_emp1_user_id, 'EMP-002', 'Rahul', 'Sharma',
        'rahul.sharma@humoratechnologies.com', v_eng_dept_id, v_admin_emp_id, '2024-06-01', 'full_time', 'active'
    ) ON CONFLICT (tenant_id, employee_code) DO UPDATE
    SET manager_id = v_admin_emp_id, first_name = 'Rahul', last_name = 'Sharma', user_id = v_emp1_user_id;

    -- Leave Balances for Rahul
    INSERT INTO hrms_leave_balances (tenant_id, employee_id, leave_type_id, year, credited, used, balance)
    VALUES
        (v_tenant_id, v_emp1_emp_id, v_pl_leave_id, 2026, 18.00, 0.00, 18.00),
        (v_tenant_id, v_emp1_emp_id, v_sl_leave_id, 2026, 12.00, 0.00, 12.00),
        (v_tenant_id, v_emp1_emp_id, v_cl_leave_id, 2026, 8.00, 0.00, 8.00)
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

    -- 4. Create Employee 2: Priya Patel (Reports to Humora Technologies)
    INSERT INTO users (id, tenant_id, email, password_hash, status, presence_status)
    VALUES (v_emp2_user_id, v_tenant_id, 'priya.patel@humoratechnologies.com', v_pwd_hash, 'active', 'in_office_active')
    ON CONFLICT (tenant_id, email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash, status = 'active';

    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_emp2_user_id, v_employee_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    INSERT INTO hrms_employees (
        id, tenant_id, user_id, employee_code, first_name, last_name, work_email,
        department_id, manager_id, date_of_joining, employment_type, status
    ) VALUES (
        v_emp2_emp_id, v_tenant_id, v_emp2_user_id, 'EMP-003', 'Priya', 'Patel',
        'priya.patel@humoratechnologies.com', v_design_dept_id, v_admin_emp_id, '2024-07-15', 'full_time', 'active'
    ) ON CONFLICT (tenant_id, employee_code) DO UPDATE
    SET manager_id = v_admin_emp_id, first_name = 'Priya', last_name = 'Patel', user_id = v_emp2_user_id;

    -- Leave Balances for Priya
    INSERT INTO hrms_leave_balances (tenant_id, employee_id, leave_type_id, year, credited, used, balance)
    VALUES
        (v_tenant_id, v_emp2_emp_id, v_pl_leave_id, 2026, 18.00, 0.00, 18.00),
        (v_tenant_id, v_emp2_emp_id, v_sl_leave_id, 2026, 12.00, 0.00, 12.00),
        (v_tenant_id, v_emp2_emp_id, v_cl_leave_id, 2026, 8.00, 0.00, 8.00)
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

END $$;
