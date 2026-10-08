-- Pulse: end-to-end encrypted messaging.
-- The server stores routing metadata and opaque ciphertext only.

-- One row per installed client (a browser profile or a phone).
CREATE TABLE IF NOT EXISTS pulse_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL, -- 'web', 'android', 'ios'
    name VARCHAR(120) NOT NULL DEFAULT '',
    identity_key BYTEA NOT NULL, -- public signature key of the device
    push_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pulse_devices_user ON pulse_devices(user_id) WHERE revoked_at IS NULL;

-- Pre-published one-time key packages, so a sender can start an encrypted
-- session with a device that is offline.
CREATE TABLE IF NOT EXISTS pulse_key_packages (
    id BIGSERIAL PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES pulse_devices(id) ON DELETE CASCADE,
    key_package BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_key_packages_device ON pulse_key_packages(device_id, id);

CREATE TABLE IF NOT EXISTS pulse_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL, -- 'dm', 'group', 'channel'
    name VARCHAR(120) NOT NULL DEFAULT '',
    topic VARCHAR(500) NOT NULL DEFAULT '',
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    dm_key VARCHAR(80), -- '<lower user id>:<higher user id>' for DMs, else NULL
    created_by UUID NOT NULL REFERENCES users(id),
    last_seq BIGINT NOT NULL DEFAULT 0,
    epoch BIGINT NOT NULL DEFAULT 0, -- key-agreement epoch; handshakes must advance it by exactly one
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, dm_key)
);

CREATE TABLE IF NOT EXISTS pulse_members (
    conversation_id UUID NOT NULL REFERENCES pulse_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_seq BIGINT NOT NULL DEFAULT 0, -- conversation last_seq when the member joined
    delivered_seq BIGINT NOT NULL DEFAULT 0, -- double tick watermark
    read_seq BIGINT NOT NULL DEFAULT 0, -- blue tick watermark
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pulse_members_user ON pulse_members(user_id);

-- Append-only encrypted message log. (conversation_id, seq) is the read path
-- for both gap sync and scroll-back; (conversation_id, id) dedupes retries.
CREATE TABLE IF NOT EXISTS pulse_messages (
    conversation_id UUID NOT NULL REFERENCES pulse_conversations(id) ON DELETE CASCADE,
    seq BIGINT NOT NULL,
    id UUID NOT NULL, -- client-generated
    sender_id UUID NOT NULL,
    sender_device_id UUID NOT NULL,
    kind SMALLINT NOT NULL,
    epoch BIGINT NOT NULL DEFAULT 0, -- epoch a handshake moves to / a message was sealed in
    ciphertext BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, seq),
    UNIQUE (conversation_id, id)
);

-- Device-addressed payloads (welcomes, key shares); deleted once acked.
CREATE TABLE IF NOT EXISTS pulse_device_inbox (
    id BIGSERIAL PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES pulse_devices(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL,
    from_device_id UUID NOT NULL,
    conversation_id UUID,
    payload BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_device_inbox_device ON pulse_device_inbox(device_id, id);

-- Message keys, encrypted on the client under the user's recovery key, so a
-- new device can read stored history.
CREATE TABLE IF NOT EXISTS pulse_key_backups (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES pulse_conversations(id) ON DELETE CASCADE,
    epoch BIGINT NOT NULL,
    encrypted_key BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, conversation_id, epoch)
);
