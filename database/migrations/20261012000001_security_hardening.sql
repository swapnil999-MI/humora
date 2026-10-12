-- Security hardening (2026-10-12 audit).

-- Password-reset codes are stored as an HMAC, not in clear, and a code is burned
-- after a few wrong guesses so it cannot be brute-forced.
ALTER TABLE password_reset_otps ALTER COLUMN otp_code TYPE VARCHAR(64);
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
-- Codes issued before this migration were stored in clear; retire them.
UPDATE password_reset_otps SET used = TRUE WHERE used = FALSE;

-- Refresh tokens issued before this moment are refused (set on password reset).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after TIMESTAMPTZ;
