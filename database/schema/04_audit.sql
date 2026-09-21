-- Cryptographic Append-Only Hash-Chained Audit Ledger
CREATE TABLE IF NOT EXISTS audit_ledger (
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

CREATE INDEX IF NOT EXISTS idx_audit_ledger_chain ON audit_ledger (tenant_id, entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_created ON audit_ledger (tenant_id, created_at);
