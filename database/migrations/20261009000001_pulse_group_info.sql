-- Pulse: the latest signed GroupInfo of each conversation's encryption group.
-- It is the group's public state (members, tree, the epoch's external key) and
-- lets a member's new device join on its own (MLS external commit) while every
-- other device is offline. It holds no secrets and no message content.
ALTER TABLE pulse_conversations ADD COLUMN IF NOT EXISTS group_info BYTEA;
-- Epoch the stored group_info is for; it is only served while it equals epoch.
ALTER TABLE pulse_conversations ADD COLUMN IF NOT EXISTS group_info_epoch BIGINT NOT NULL DEFAULT 0;
