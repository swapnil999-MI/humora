-- Migration: Add Biometric Face Verification columns to hrms_employees and hrms_attendance_punches
-- Date: 2026-09-16

ALTER TABLE hrms_employees ADD COLUMN IF NOT EXISTS biometric_face_url TEXT;
ALTER TABLE hrms_employees ADD COLUMN IF NOT EXISTS face_embedding JSONB;
ALTER TABLE hrms_employees ADD COLUMN IF NOT EXISTS biometric_face_registered_at TIMESTAMPTZ;
ALTER TABLE hrms_employees ADD COLUMN IF NOT EXISTS biometric_sample_count INT DEFAULT 1;

ALTER TABLE hrms_attendance_punches ADD COLUMN IF NOT EXISTS is_face_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE hrms_attendance_punches ADD COLUMN IF NOT EXISTS face_confidence NUMERIC(5,2);
ALTER TABLE hrms_attendance_punches ADD COLUMN IF NOT EXISTS face_distance NUMERIC(6,4);
ALTER TABLE hrms_attendance_punches ADD COLUMN IF NOT EXISTS selfie_url TEXT;
