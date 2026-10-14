-- Every attendance punch must be verified by face or by fingerprint (2026-10-14).

-- Fingerprint punches are signed on the phone by a hardware-backed key that only
-- works after a fingerprint scan. HR/admin first allows fingerprint punching for an
-- employee (a row with no key); the employee then registers one phone, which requires
-- a live face match. Deleting the row turns fingerprint punching off for that employee.
CREATE TABLE IF NOT EXISTS hrms_punch_devices (
    employee_id UUID PRIMARY KEY REFERENCES hrms_employees(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    public_key TEXT, -- base64 DER SubjectPublicKeyInfo, ECDSA P-256; NULL until the employee sets up a phone
    device_label VARCHAR(120) NOT NULL DEFAULT '',
    allowed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    allowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registered_at TIMESTAMPTZ
);

ALTER TABLE hrms_attendance_punches ADD COLUMN IF NOT EXISTS is_device_verified BOOLEAN NOT NULL DEFAULT FALSE;
-- The one-time server challenge a fingerprint punch signed; unique so it cannot be replayed.
ALTER TABLE hrms_attendance_punches ADD COLUMN IF NOT EXISTS device_challenge TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hrms_attendance_punches_device_challenge
    ON hrms_attendance_punches(device_challenge) WHERE device_challenge IS NOT NULL;
