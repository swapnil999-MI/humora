-- Each shift carries the time zone of the admin dashboard that created it (IANA name, e.g.
-- Asia/Kolkata). It is fixed at creation. Attendance days, "today", late check-ins and shift
-- times are worked out strictly in it; every stored instant stays UTC.
-- Shifts that already exist were all created for Indian offices, so they get Asia/Kolkata;
-- after that the column has no default, so every new shift must say its zone.
ALTER TABLE hrms_shifts ADD COLUMN IF NOT EXISTS time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE hrms_shifts ALTER COLUMN time_zone DROP DEFAULT;
