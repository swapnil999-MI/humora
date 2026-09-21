-- Migration: Add avatar_url and banner_url to hrms_employees and users
-- Date: 2026-09-16

ALTER TABLE hrms_employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE hrms_employees ADD COLUMN IF NOT EXISTS banner_url TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
