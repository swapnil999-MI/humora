-- In-app notifications: one row per recipient. Created by server-side events
-- (leave decisions, approvals waiting, payslips, task assignments, ...).
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,          -- leave | approval | attendance | payroll | expense | onboarding | work | system
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link VARCHAR(50),                       -- web page id to open, e.g. 'approvals'
    entity_type VARCHAR(40),
    entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
