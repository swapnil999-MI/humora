-- Workflows & Statuses
CREATE TABLE IF NOT EXISTS work_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_workflow_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES work_workflows(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'todo', 'in_progress', 'done'
    position INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS work_workflow_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES work_workflows(id) ON DELETE CASCADE,
    from_status_id UUID REFERENCES work_workflow_statuses(id) ON DELETE CASCADE,
    to_status_id UUID NOT NULL REFERENCES work_workflow_statuses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    guard_rule TEXT, -- CEL expression or rule
    validators JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS work_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(10) NOT NULL, -- 'HUM', 'ENG', 'MKT'
    name VARCHAR(255) NOT NULL,
    lead_id UUID NOT NULL REFERENCES hrms_employees(id),
    workflow_id UUID NOT NULL REFERENCES work_workflows(id),
    project_type VARCHAR(50) NOT NULL DEFAULT 'scrum', -- 'scrum', 'kanban', 'service'
    last_issue_number INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, key)
);

-- Sprints (Integrated with HRMS Capacity Engine)
CREATE TABLE IF NOT EXISTS work_sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    goal TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'future', -- 'future', 'active', 'closed'
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    calculated_capacity_hours NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Issues (Initiatives, Epics, Stories, Tasks, Bugs, Sub-tasks)
CREATE TABLE IF NOT EXISTS work_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
    issue_number INT NOT NULL,
    issue_key VARCHAR(25) NOT NULL, -- e.g. HUM-101
    parent_id UUID REFERENCES work_issues(id) ON DELETE SET NULL,
    sprint_id UUID REFERENCES work_sprints(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    issue_type VARCHAR(50) NOT NULL, -- 'epic', 'story', 'task', 'bug', 'subtask'
    status_id UUID NOT NULL REFERENCES work_workflow_statuses(id),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'lowest', 'low', 'medium', 'high', 'highest'
    assignee_id UUID REFERENCES hrms_employees(id) ON DELETE SET NULL,
    reporter_id UUID NOT NULL REFERENCES hrms_employees(id),
    story_points INT,
    original_estimate_seconds INT DEFAULT 0,
    remaining_estimate_seconds INT DEFAULT 0,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, issue_number)
);

-- Issue Links (Blocks, Relates to, Duplicates)
CREATE TABLE IF NOT EXISTS work_issue_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inward_issue_id UUID NOT NULL REFERENCES work_issues(id) ON DELETE CASCADE,
    outward_issue_id UUID NOT NULL REFERENCES work_issues(id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL, -- 'blocks', 'is_blocked_by', 'relates_to', 'duplicates'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worklogs (Dual link to Work Issue and HRMS Timesheet)
CREATE TABLE IF NOT EXISTS work_worklogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES work_issues(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms_employees(id) ON DELETE CASCADE,
    time_spent_seconds INT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    is_billable BOOLEAN NOT NULL DEFAULT TRUE,
    timesheet_entry_id UUID REFERENCES hrms_timesheet_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Work Service SLA Policies
CREATE TABLE IF NOT EXISTS work_sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- 'first_response', 'resolution'
    priority VARCHAR(20) NOT NULL,
    target_seconds INT NOT NULL,
    business_hours_only BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_issues_project_sprint ON work_issues(project_id, sprint_id);
CREATE INDEX IF NOT EXISTS idx_work_issues_assignee ON work_issues(assignee_id);
CREATE INDEX IF NOT EXISTS idx_work_issues_key ON work_issues(issue_key);
CREATE INDEX IF NOT EXISTS idx_work_worklogs_issue ON work_worklogs(issue_id);
