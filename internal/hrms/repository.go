package hrms

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	CreateEmployee(ctx context.Context, emp *Employee) error
	GetEmployeeByID(ctx context.Context, tenantID, id uuid.UUID) (*Employee, error)
	GetEmployeeByUserID(ctx context.Context, tenantID, userID uuid.UUID) (*Employee, error)
	GetPunchDevice(ctx context.Context, tenantID, employeeID uuid.UUID) (*PunchDevice, error)
	ListPunchDevices(ctx context.Context, tenantID uuid.UUID) ([]PunchDevice, error)
	AllowPunchDevice(ctx context.Context, tenantID, employeeID, allowedBy uuid.UUID) error
	BindPunchDeviceKey(ctx context.Context, tenantID, employeeID uuid.UUID, publicKey, label string) (bool, error)
	DeletePunchDevice(ctx context.Context, tenantID, employeeID uuid.UUID) error
	ClearEmployeeBiometricFace(ctx context.Context, tenantID, employeeID uuid.UUID) error
	ListEmployees(ctx context.Context, tenantID uuid.UUID, search, deptID string, limit, offset int) ([]Employee, int64, error)
	GetOrgHierarchy(ctx context.Context, tenantID uuid.UUID) ([]Employee, error)

	GetOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID) (*OfficeLocation, error)
	ListOfficeLocations(ctx context.Context, tenantID uuid.UUID) ([]OfficeLocation, error)
	CreateOfficeLocation(ctx context.Context, loc *OfficeLocation) error
	UpdateOfficeLocation(ctx context.Context, loc *OfficeLocation) error
	DeleteOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID) error

	CreateAttendancePunch(ctx context.Context, punch *AttendancePunch) error
	GetLastPunch(ctx context.Context, tenantID, employeeID uuid.UUID) (*AttendancePunch, error)
	GetTodayPunches(ctx context.Context, tenantID, employeeID uuid.UUID, dayStart time.Time) ([]AttendancePunch, error)
	GetFirstEmployeeShift(ctx context.Context, tenantID, employeeID uuid.UUID) (*Shift, error)

	GetLeaveType(ctx context.Context, tenantID, id uuid.UUID) (*LeaveType, error)
	ListLeaveTypes(ctx context.Context, tenantID uuid.UUID) ([]LeaveType, error)
	GetLeaveBalance(ctx context.Context, tenantID, employeeID, leaveTypeID uuid.UUID, year int) (*LeaveBalance, error)
	ListLeaveBalances(ctx context.Context, tenantID, employeeID uuid.UUID, year int) ([]LeaveBalance, error)
	CreateLeaveRequest(ctx context.Context, req *LeaveRequest) error
	ListLeaveRequests(ctx context.Context, tenantID uuid.UUID, employeeID *uuid.UUID, limit, offset int) ([]LeaveRequest, int64, error)
	UpdateLeaveRequestStatus(ctx context.Context, tenantID, requestID uuid.UUID, status string, approverID uuid.UUID) (*LeaveRequest, error)
	DeductLeaveBalance(ctx context.Context, tenantID, employeeID, leaveTypeID uuid.UUID, year int, days float64) error

	ListPublicHolidays(ctx context.Context, tenantID uuid.UUID, year int) ([]PublicHoliday, error)

	// Shifts & Rosters
	CreateShift(ctx context.Context, shift *Shift) error
	ListShifts(ctx context.Context, tenantID uuid.UUID) ([]Shift, error)
	GetShiftByID(ctx context.Context, tenantID, id uuid.UUID) (*Shift, error)
	UpdateShift(ctx context.Context, shift *Shift) error
	DeleteShift(ctx context.Context, tenantID, id uuid.UUID) error
	AssignShift(ctx context.Context, tenantID, employeeID, shiftID uuid.UUID, effectiveDate time.Time) error
	GetEmployeeShift(ctx context.Context, tenantID, employeeID uuid.UUID, date time.Time) (*Shift, error)
	ListEmployeeRosters(ctx context.Context, tenantID uuid.UUID) ([]EmployeeShiftRosterView, error)

	// Punches & Calendar Range
	GetPunchesByDateRange(ctx context.Context, tenantID, employeeID uuid.UUID, start, end time.Time) ([]AttendancePunch, error)
	GetTeamPunchesSince(ctx context.Context, tenantID uuid.UUID, since time.Time) ([]AttendancePunch, error)
	GetApprovedLeavesByDateRange(ctx context.Context, tenantID, employeeID uuid.UUID, start, end time.Time) ([]LeaveRequest, error)
	HasOverlappingLeave(ctx context.Context, tenantID, employeeID uuid.UUID, from, to time.Time) (bool, error)

	// Regularizations
	CreateRegularization(ctx context.Context, reg *AttendanceRegularization) error
	ListRegularizations(ctx context.Context, tenantID uuid.UUID, employeeID *uuid.UUID, status string) ([]AttendanceRegularization, error)
	GetRegularizationByID(ctx context.Context, tenantID, id uuid.UUID) (*AttendanceRegularization, error)
	UpdateRegularizationStatus(ctx context.Context, tenantID, id, approverID uuid.UUID, status string) (*AttendanceRegularization, error)

	// Departments & Designations
	ListDepartments(ctx context.Context, tenantID uuid.UUID) ([]Department, error)
	CreateDepartment(ctx context.Context, dept *Department) error
	ListDesignations(ctx context.Context, tenantID uuid.UUID) ([]Designation, error)
	CreateDesignation(ctx context.Context, desig *Designation) error

	// Biometric Face Enrollment
	UpdateEmployeeBiometricFace(ctx context.Context, tenantID, employeeID uuid.UUID, faceURL, embeddingJSON string, sampleCount int) error
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateEmployee(ctx context.Context, emp *Employee) error {
	query := `
		INSERT INTO hrms_employees (
			id, tenant_id, user_id, employee_code, first_name, last_name, work_email,
			personal_email, phone, department_id, designation_id, manager_id,
			date_of_joining, employment_type, status, hourly_cost_rate, custom_profile_fields,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
		)
	`
	if emp.ID == uuid.Nil {
		emp.ID = uuid.New()
	}
	now := time.Now().UTC()
	emp.CreatedAt = now
	emp.UpdatedAt = now
	if emp.Status == "" {
		emp.Status = "active"
	}
	if emp.CustomProfileFields == "" {
		emp.CustomProfileFields = "{}"
	}

	_, err := r.db.ExecContext(ctx, query,
		emp.ID, emp.TenantID, emp.UserID, emp.EmployeeCode, emp.FirstName, emp.LastName, emp.WorkEmail,
		emp.PersonalEmail, emp.Phone, emp.DepartmentID, emp.DesignationID, emp.ManagerID,
		emp.DateOfJoining, emp.EmploymentType, emp.Status, emp.HourlyCostRate, emp.CustomProfileFields,
		emp.CreatedAt, emp.UpdatedAt,
	)
	return err
}

func (r *repository) GetEmployeeByID(ctx context.Context, tenantID, id uuid.UUID) (*Employee, error) {
	var emp Employee
	query := `
		SELECT e.*, d.name AS department_name, ds.title AS designation_title,
		       CONCAT(m.first_name, ' ', m.last_name) AS manager_name
		FROM hrms_employees e
		LEFT JOIN hrms_departments d ON e.department_id = d.id
		LEFT JOIN hrms_designations ds ON e.designation_id = ds.id
		LEFT JOIN hrms_employees m ON e.manager_id = m.id
		WHERE e.tenant_id = $1 AND e.id = $2
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &emp, query, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &emp, nil
}

func (r *repository) GetEmployeeByUserID(ctx context.Context, tenantID, userID uuid.UUID) (*Employee, error) {
	var emp Employee
	query := `
		SELECT e.*, d.name AS department_name, ds.title AS designation_title
		FROM hrms_employees e
		LEFT JOIN hrms_departments d ON e.department_id = d.id
		LEFT JOIN hrms_designations ds ON e.designation_id = ds.id
		WHERE e.tenant_id = $1 AND e.user_id = $2
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &emp, query, tenantID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &emp, nil
}

func (r *repository) ListEmployees(ctx context.Context, tenantID uuid.UUID, search, deptID string, limit, offset int) ([]Employee, int64, error) {
	where := "WHERE e.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if search != "" {
		where += fmt.Sprintf(" AND (e.first_name ILIKE $%d OR e.last_name ILIKE $%d OR e.work_email ILIKE $%d OR e.employee_code ILIKE $%d)", argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if deptID != "" {
		where += fmt.Sprintf(" AND e.department_id = $%d", argIdx)
		args = append(args, deptID)
		argIdx++
	}

	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM hrms_employees e %s", where)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT 
			e.id, e.tenant_id, e.user_id, e.employee_code, e.first_name, e.last_name, 
			e.work_email, e.personal_email, e.phone, e.department_id, e.designation_id, 
			e.manager_id, e.secondary_manager_id, e.date_of_joining, e.date_of_exit, 
			e.employment_type, e.status, e.hourly_cost_rate, e.custom_profile_fields, 
			e.avatar_url, e.banner_url, e.biometric_sample_count,
			e.created_at, e.updated_at,
			d.name AS department_name, ds.title AS designation_title
		FROM hrms_employees e
		LEFT JOIN hrms_departments d ON e.department_id = d.id
		LEFT JOIN hrms_designations ds ON e.designation_id = ds.id
		%s
		ORDER BY e.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)

	args = append(args, limit, offset)

	var employees []Employee
	if err := r.db.SelectContext(ctx, &employees, query, args...); err != nil {
		return nil, 0, err
	}

	return employees, total, nil
}

func (r *repository) GetOrgHierarchy(ctx context.Context, tenantID uuid.UUID) ([]Employee, error) {
	query := `
		SELECT e.id, e.tenant_id, e.first_name, e.last_name, e.work_email, e.manager_id,
		       d.name AS department_name, ds.title AS designation_title
		FROM hrms_employees e
		LEFT JOIN hrms_departments d ON e.department_id = d.id
		LEFT JOIN hrms_designations ds ON e.designation_id = ds.id
		WHERE e.tenant_id = $1 AND e.status = 'active'
		ORDER BY e.manager_id NULLS FIRST, e.first_name ASC
	`
	var employees []Employee
	err := r.db.SelectContext(ctx, &employees, query, tenantID)
	return employees, err
}

func (r *repository) GetOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID) (*OfficeLocation, error) {
	var loc OfficeLocation
	query := `SELECT * FROM hrms_office_locations WHERE tenant_id = $1 AND id = $2 LIMIT 1`
	err := r.db.GetContext(ctx, &loc, query, tenantID, locationID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &loc, nil
}

func (r *repository) ListOfficeLocations(ctx context.Context, tenantID uuid.UUID) ([]OfficeLocation, error) {
	var locs []OfficeLocation
	query := `SELECT * FROM hrms_office_locations WHERE tenant_id = $1 ORDER BY name ASC`
	err := r.db.SelectContext(ctx, &locs, query, tenantID)
	return locs, err
}

func (r *repository) CreateOfficeLocation(ctx context.Context, loc *OfficeLocation) error {
	query := `
		INSERT INTO hrms_office_locations (
			id, tenant_id, name, latitude, longitude, radius_meters,
			polygon_coordinates, allowed_ip_ranges, allowed_wifi_bssid, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	if loc.ID == uuid.Nil {
		loc.ID = uuid.New()
	}
	loc.CreatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx, query,
		loc.ID, loc.TenantID, loc.Name, loc.Latitude, loc.Longitude, loc.RadiusMeters,
		loc.PolygonCoordinates, loc.AllowedIPRanges, loc.AllowedWiFiBSSID, loc.CreatedAt,
	)
	return err
}

func (r *repository) UpdateOfficeLocation(ctx context.Context, loc *OfficeLocation) error {
	query := `
		UPDATE hrms_office_locations
		SET name = $1, latitude = $2, longitude = $3, radius_meters = $4,
		    polygon_coordinates = $5, allowed_ip_ranges = $6, allowed_wifi_bssid = $7
		WHERE tenant_id = $8 AND id = $9
	`
	_, err := r.db.ExecContext(ctx, query,
		loc.Name, loc.Latitude, loc.Longitude, loc.RadiusMeters,
		loc.PolygonCoordinates, loc.AllowedIPRanges, loc.AllowedWiFiBSSID,
		loc.TenantID, loc.ID,
	)
	return err
}

func (r *repository) DeleteOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID) error {
	query := `DELETE FROM hrms_office_locations WHERE tenant_id = $1 AND id = $2`
	_, err := r.db.ExecContext(ctx, query, tenantID, locationID)
	return err
}

func (r *repository) CreateAttendancePunch(ctx context.Context, punch *AttendancePunch) error {
	query := `
		INSERT INTO hrms_attendance_punches (
			id, tenant_id, employee_id, punch_type, punched_at, latitude, longitude,
			accuracy_meters, location_id, is_geofence_verified, is_offline_signed,
			offline_signature, source, is_face_verified, face_confidence, face_distance,
			selfie_url, created_at, is_device_verified, device_challenge
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
		)
	`
	if punch.ID == uuid.Nil {
		punch.ID = uuid.New()
	}
	punch.CreatedAt = time.Now().UTC()

	_, err := r.db.ExecContext(ctx, query,
		punch.ID, punch.TenantID, punch.EmployeeID, punch.PunchType, punch.PunchedAt,
		punch.Latitude, punch.Longitude, punch.AccuracyMeters, punch.LocationID,
		punch.IsGeofenceVerified, punch.IsOfflineSigned, punch.OfflineSignature,
		punch.Source, punch.IsFaceVerified, punch.FaceConfidence, punch.FaceDistance,
		punch.SelfieURL, punch.CreatedAt, punch.IsDeviceVerified, punch.DeviceChallenge,
	)
	return err
}

const punchDeviceColumns = `employee_id, tenant_id, COALESCE(public_key, '') AS public_key, device_label, allowed_at, registered_at`

func (r *repository) GetPunchDevice(ctx context.Context, tenantID, employeeID uuid.UUID) (*PunchDevice, error) {
	var d PunchDevice
	err := r.db.GetContext(ctx, &d, `SELECT `+punchDeviceColumns+` FROM hrms_punch_devices WHERE tenant_id = $1 AND employee_id = $2`, tenantID, employeeID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *repository) ListPunchDevices(ctx context.Context, tenantID uuid.UUID) ([]PunchDevice, error) {
	var out []PunchDevice
	err := r.db.SelectContext(ctx, &out, `SELECT `+punchDeviceColumns+` FROM hrms_punch_devices WHERE tenant_id = $1`, tenantID)
	return out, err
}

// AllowPunchDevice turns fingerprint punching on for an employee (no phone yet).
func (r *repository) AllowPunchDevice(ctx context.Context, tenantID, employeeID, allowedBy uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO hrms_punch_devices (employee_id, tenant_id, allowed_by, allowed_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (employee_id) DO NOTHING
	`, employeeID, tenantID, allowedBy)
	return err
}

// BindPunchDeviceKey stores the phone key; false when fingerprint punching is not allowed.
func (r *repository) BindPunchDeviceKey(ctx context.Context, tenantID, employeeID uuid.UUID, publicKey, label string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `
		UPDATE hrms_punch_devices SET public_key = $1, device_label = $2, registered_at = NOW()
		WHERE tenant_id = $3 AND employee_id = $4
	`, publicKey, label, tenantID, employeeID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (r *repository) DeletePunchDevice(ctx context.Context, tenantID, employeeID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM hrms_punch_devices WHERE tenant_id = $1 AND employee_id = $2`, tenantID, employeeID)
	return err
}

// ClearEmployeeBiometricFace removes the enrolled face template, so face punches fail until HR enrolls again.
func (r *repository) ClearEmployeeBiometricFace(ctx context.Context, tenantID, employeeID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE hrms_employees
		SET biometric_face_url = NULL, face_embedding = NULL, biometric_face_registered_at = NULL,
		    biometric_sample_count = 0, updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, employeeID)
	return err
}

func (r *repository) UpdateEmployeeBiometricFace(ctx context.Context, tenantID, employeeID uuid.UUID, faceURL, embeddingJSON string, sampleCount int) error {
	query := `
		UPDATE hrms_employees
		SET biometric_face_url = $1,
		    face_embedding = $2::jsonb,
		    biometric_face_registered_at = $3,
		    biometric_sample_count = $4,
		    updated_at = $3
		WHERE tenant_id = $5 AND id = $6
	`
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx, query, faceURL, embeddingJSON, now, sampleCount, tenantID, employeeID)
	return err
}

const punchSelectColumns = `
	id, tenant_id, employee_id, punch_type, punched_at, 
	latitude, longitude, accuracy_meters, location_id, 
	is_geofence_verified, is_offline_signed, offline_signature, 
	device_info, source, is_face_verified, face_confidence, 
	face_distance, created_at
`

func (r *repository) GetLastPunch(ctx context.Context, tenantID, employeeID uuid.UUID) (*AttendancePunch, error) {
	var punch AttendancePunch
	query := fmt.Sprintf(`
		SELECT %s FROM hrms_attendance_punches
		WHERE tenant_id = $1 AND employee_id = $2
		ORDER BY punched_at DESC
		LIMIT 1
	`, punchSelectColumns)
	err := r.db.GetContext(ctx, &punch, query, tenantID, employeeID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &punch, nil
}

// GetTodayPunches returns the employee's punches since dayStart (local midnight in their shift's zone).
func (r *repository) GetTodayPunches(ctx context.Context, tenantID, employeeID uuid.UUID, dayStart time.Time) ([]AttendancePunch, error) {
	var punches []AttendancePunch
	query := fmt.Sprintf(`
		SELECT %s FROM hrms_attendance_punches
		WHERE tenant_id = $1 AND employee_id = $2 AND punched_at >= $3
		ORDER BY punched_at ASC
	`, punchSelectColumns)
	err := r.db.SelectContext(ctx, &punches, query, tenantID, employeeID, dayStart)
	return punches, err
}

// GetFirstEmployeeShift is the employee's earliest assigned shift (nil if they never had one).
func (r *repository) GetFirstEmployeeShift(ctx context.Context, tenantID, employeeID uuid.UUID) (*Shift, error) {
	var shift Shift
	err := r.db.GetContext(ctx, &shift, `
		SELECT s.* FROM hrms_shift_rosters r
		JOIN hrms_shifts s ON r.shift_id = s.id
		WHERE r.tenant_id = $1 AND r.employee_id = $2
		ORDER BY r.effective_date ASC
		LIMIT 1
	`, tenantID, employeeID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &shift, nil
}

func (r *repository) GetLeaveType(ctx context.Context, tenantID, id uuid.UUID) (*LeaveType, error) {
	var lt LeaveType
	query := `SELECT * FROM hrms_leave_types WHERE tenant_id = $1 AND id = $2 LIMIT 1`
	err := r.db.GetContext(ctx, &lt, query, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &lt, nil
}

func (r *repository) ListLeaveTypes(ctx context.Context, tenantID uuid.UUID) ([]LeaveType, error) {
	var lts []LeaveType
	query := `SELECT * FROM hrms_leave_types WHERE tenant_id = $1 ORDER BY name ASC`
	err := r.db.SelectContext(ctx, &lts, query, tenantID)
	return lts, err
}

func (r *repository) GetLeaveBalance(ctx context.Context, tenantID, employeeID, leaveTypeID uuid.UUID, year int) (*LeaveBalance, error) {
	var lb LeaveBalance
	query := `
		SELECT lb.*, lt.name AS leave_type_name, lt.code AS leave_type_code
		FROM hrms_leave_balances lb
		JOIN hrms_leave_types lt ON lb.leave_type_id = lt.id
		WHERE lb.tenant_id = $1 AND lb.employee_id = $2 AND lb.leave_type_id = $3 AND lb.year = $4
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &lb, query, tenantID, employeeID, leaveTypeID, year)
	if err != nil {
		if err == sql.ErrNoRows {
			// Auto-provision initial balance if missing
			initQuery := `
				INSERT INTO hrms_leave_balances (id, tenant_id, employee_id, leave_type_id, balance, credited, used, year, created_at)
				SELECT gen_random_uuid(), $1, $2, $3, annual_quota, annual_quota, 0.0, $4, NOW()
				FROM hrms_leave_types WHERE id = $3
				RETURNING id, tenant_id, employee_id, leave_type_id, balance, credited, used, year, created_at
			`
			if insertErr := r.db.GetContext(ctx, &lb, initQuery, tenantID, employeeID, leaveTypeID, year); insertErr == nil {
				return &lb, nil
			}
			return nil, nil
		}
		return nil, err
	}
	return &lb, nil
}

func (r *repository) ListLeaveBalances(ctx context.Context, tenantID, employeeID uuid.UUID, year int) ([]LeaveBalance, error) {
	query := `
		SELECT lb.*, lt.name AS leave_type_name, lt.code AS leave_type_code
		FROM hrms_leave_balances lb
		JOIN hrms_leave_types lt ON lb.leave_type_id = lt.id
		WHERE lb.tenant_id = $1 AND lb.employee_id = $2 AND lb.year = $3
		ORDER BY lt.name ASC
	`
	var balances []LeaveBalance
	err := r.db.SelectContext(ctx, &balances, query, tenantID, employeeID, year)
	return balances, err
}

func (r *repository) CreateLeaveRequest(ctx context.Context, req *LeaveRequest) error {
	query := `
		INSERT INTO hrms_leave_requests (
			id, tenant_id, employee_id, leave_type_id, from_date, to_date,
			total_days, sandwich_days_added, reason, status, current_approval_level, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
	`
	if req.ID == uuid.Nil {
		req.ID = uuid.New()
	}
	req.CreatedAt = time.Now().UTC()
	if req.Status == "" {
		req.Status = "pending"
	}
	if req.CurrentApprovalLevel == 0 {
		req.CurrentApprovalLevel = 1
	}

	_, err := r.db.ExecContext(ctx, query,
		req.ID, req.TenantID, req.EmployeeID, req.LeaveTypeID, req.FromDate, req.ToDate,
		req.TotalDays, req.SandwichDaysAdded, req.Reason, req.Status, req.CurrentApprovalLevel, req.CreatedAt,
	)
	return err
}

func (r *repository) ListLeaveRequests(ctx context.Context, tenantID uuid.UUID, employeeID *uuid.UUID, limit, offset int) ([]LeaveRequest, int64, error) {
	where := "WHERE lr.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if employeeID != nil {
		where += fmt.Sprintf(" AND lr.employee_id = $%d", argIdx)
		args = append(args, *employeeID)
		argIdx++
	}

	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM hrms_leave_requests lr %s", where)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT lr.*, lt.name AS leave_type_name, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
		FROM hrms_leave_requests lr
		JOIN hrms_leave_types lt ON lr.leave_type_id = lt.id
		JOIN hrms_employees e ON lr.employee_id = e.id
		%s
		ORDER BY lr.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)

	args = append(args, limit, offset)

	var requests []LeaveRequest
	if err := r.db.SelectContext(ctx, &requests, query, args...); err != nil {
		return nil, 0, err
	}

	return requests, total, nil
}

// errAlreadyDecided covers requests that are missing, no longer pending (approving
// twice would deduct leave twice) or belong to the approver themself.
var errAlreadyDecided = errors.New("request not found, already decided, or it is your own request")

func (r *repository) UpdateLeaveRequestStatus(ctx context.Context, tenantID, requestID uuid.UUID, status string, approverID uuid.UUID) (*LeaveRequest, error) {
	var req LeaveRequest
	query := `
		UPDATE hrms_leave_requests
		SET status = $1, approved_by = $2
		WHERE tenant_id = $3 AND id = $4 AND status = 'pending' AND employee_id <> $2
		RETURNING *
	`
	err := r.db.GetContext(ctx, &req, query, status, approverID, tenantID, requestID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errAlreadyDecided
	}
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func (r *repository) DeductLeaveBalance(ctx context.Context, tenantID, employeeID, leaveTypeID uuid.UUID, year int, days float64) error {
	query := `
		UPDATE hrms_leave_balances
		SET balance = balance - $1, used = used + $1
		WHERE tenant_id = $2 AND employee_id = $3 AND leave_type_id = $4 AND year = $5
	`
	_, err := r.db.ExecContext(ctx, query, days, tenantID, employeeID, leaveTypeID, year)
	return err
}

func (r *repository) ListPublicHolidays(ctx context.Context, tenantID uuid.UUID, year int) ([]PublicHoliday, error) {
	var holidays []PublicHoliday
	query := `
		SELECT * FROM hrms_holidays
		WHERE tenant_id = $1 AND EXTRACT(YEAR FROM holiday_date) = $2
		ORDER BY holiday_date ASC
	`
	err := r.db.SelectContext(ctx, &holidays, query, tenantID, year)
	return holidays, err
}

func (r *repository) CreateShift(ctx context.Context, shift *Shift) error {
	if shift.ID == uuid.Nil {
		shift.ID = uuid.New()
	}
	shift.CreatedAt = time.Now().UTC()
	query := `
		INSERT INTO hrms_shifts (
			id, tenant_id, name, start_time, end_time, grace_minutes,
			half_day_hours, full_day_hours, is_night_shift, night_shift_allowance, created_at, time_zone
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.db.ExecContext(ctx, query,
		shift.ID, shift.TenantID, shift.Name, shift.StartTime, shift.EndTime,
		shift.GraceMinutes, shift.HalfDayHours, shift.FullDayHours,
		shift.IsNightShift, shift.NightShiftAllowance, shift.CreatedAt, shift.TimeZone,
	)
	return err
}

func (r *repository) ListShifts(ctx context.Context, tenantID uuid.UUID) ([]Shift, error) {
	query := `SELECT * FROM hrms_shifts WHERE tenant_id = $1 ORDER BY start_time ASC, name ASC`
	var shifts []Shift
	err := r.db.SelectContext(ctx, &shifts, query, tenantID)
	return shifts, err
}

func (r *repository) GetShiftByID(ctx context.Context, tenantID, id uuid.UUID) (*Shift, error) {
	query := `SELECT * FROM hrms_shifts WHERE tenant_id = $1 AND id = $2 LIMIT 1`
	var shift Shift
	err := r.db.GetContext(ctx, &shift, query, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &shift, nil
}

func (r *repository) UpdateShift(ctx context.Context, shift *Shift) error {
	query := `
		UPDATE hrms_shifts
		SET name = $1, start_time = $2, end_time = $3, grace_minutes = $4,
		    half_day_hours = $5, full_day_hours = $6, is_night_shift = $7,
		    night_shift_allowance = $8, time_zone = $11
		WHERE tenant_id = $9 AND id = $10
	`
	_, err := r.db.ExecContext(ctx, query,
		shift.Name, shift.StartTime, shift.EndTime, shift.GraceMinutes,
		shift.HalfDayHours, shift.FullDayHours, shift.IsNightShift,
		shift.NightShiftAllowance, shift.TenantID, shift.ID, shift.TimeZone,
	)
	return err
}

func (r *repository) DeleteShift(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM hrms_shifts WHERE tenant_id = $1 AND id = $2`
	_, err := r.db.ExecContext(ctx, query, tenantID, id)
	return err
}

func (r *repository) AssignShift(ctx context.Context, tenantID, employeeID, shiftID uuid.UUID, effectiveDate time.Time) error {
	query := `
		INSERT INTO hrms_shift_rosters (id, tenant_id, employee_id, shift_id, effective_date, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
		ON CONFLICT (employee_id, effective_date)
		DO UPDATE SET shift_id = EXCLUDED.shift_id, created_at = NOW()
	`
	_, err := r.db.ExecContext(ctx, query, tenantID, employeeID, shiftID, effectiveDate)
	return err
}

func (r *repository) GetEmployeeShift(ctx context.Context, tenantID, employeeID uuid.UUID, date time.Time) (*Shift, error) {
	query := `
		SELECT s.* FROM hrms_shift_rosters r
		JOIN hrms_shifts s ON r.shift_id = s.id
		WHERE r.tenant_id = $1 AND r.employee_id = $2 AND r.effective_date <= $3
		ORDER BY r.effective_date DESC
		LIMIT 1
	`
	var shift Shift
	err := r.db.GetContext(ctx, &shift, query, tenantID, employeeID, date)
	if err == nil {
		return &shift, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	return nil, nil
}

func (r *repository) ListEmployeeRosters(ctx context.Context, tenantID uuid.UUID) ([]EmployeeShiftRosterView, error) {
	query := `
		SELECT 
			e.id AS employee_id,
			e.employee_code,
			e.first_name,
			e.last_name,
			e.work_email,
			d.name AS department_name,
			e.avatar_url,
			s.id AS shift_id,
			s.name AS shift_name,
			TO_CHAR(s.start_time, 'HH24:MI:SS') AS start_time,
			TO_CHAR(s.end_time, 'HH24:MI:SS') AS end_time,
			s.grace_minutes,
			latest_roster.effective_date
		FROM hrms_employees e
		LEFT JOIN hrms_departments d ON e.department_id = d.id
		LEFT JOIN LATERAL (
			SELECT r.shift_id, r.effective_date
			FROM hrms_shift_rosters r
			WHERE r.tenant_id = e.tenant_id AND r.employee_id = e.id
			ORDER BY r.effective_date DESC
			LIMIT 1
		) latest_roster ON TRUE
		LEFT JOIN hrms_shifts s ON latest_roster.shift_id = s.id
		WHERE e.tenant_id = $1 AND e.status = 'active'
		ORDER BY e.first_name ASC, e.last_name ASC
	`
	var list []EmployeeShiftRosterView
	err := r.db.SelectContext(ctx, &list, query, tenantID)
	return list, err
}

func (r *repository) GetPunchesByDateRange(ctx context.Context, tenantID, employeeID uuid.UUID, start, end time.Time) ([]AttendancePunch, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM hrms_attendance_punches
		WHERE tenant_id = $1 AND employee_id = $2
		  AND punched_at >= $3 AND punched_at <= $4
		ORDER BY punched_at ASC
	`, punchSelectColumns)
	var punches []AttendancePunch
	err := r.db.SelectContext(ctx, &punches, query, tenantID, employeeID, start, end)
	return punches, err
}

// GetTeamPunchesSince returns every punch in the organisation since the given instant.
func (r *repository) GetTeamPunchesSince(ctx context.Context, tenantID uuid.UUID, since time.Time) ([]AttendancePunch, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM hrms_attendance_punches
		WHERE tenant_id = $1 AND punched_at >= $2
		ORDER BY punched_at ASC
	`, punchSelectColumns)
	var punches []AttendancePunch
	err := r.db.SelectContext(ctx, &punches, query, tenantID, since)
	return punches, err
}

// HasOverlappingLeave reports a pending or approved leave of the employee touching [from, to].
func (r *repository) HasOverlappingLeave(ctx context.Context, tenantID, employeeID uuid.UUID, from, to time.Time) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, `
		SELECT EXISTS (
			SELECT 1 FROM hrms_leave_requests
			WHERE tenant_id = $1 AND employee_id = $2 AND status IN ('pending', 'approved')
			  AND from_date <= $4 AND to_date >= $3
		)`, tenantID, employeeID, from, to)
	return exists, err
}

func (r *repository) GetApprovedLeavesByDateRange(ctx context.Context, tenantID, employeeID uuid.UUID, start, end time.Time) ([]LeaveRequest, error) {
	query := `
		SELECT lr.*, lt.name AS leave_type_name
		FROM hrms_leave_requests lr
		JOIN hrms_leave_types lt ON lr.leave_type_id = lt.id
		WHERE lr.tenant_id = $1 AND lr.employee_id = $2 AND lr.status = 'approved'
		  AND lr.to_date >= $3 AND lr.from_date <= $4
		ORDER BY lr.from_date ASC
	`
	var leaves []LeaveRequest
	err := r.db.SelectContext(ctx, &leaves, query, tenantID, employeeID, start, end)
	return leaves, err
}

func (r *repository) CreateRegularization(ctx context.Context, reg *AttendanceRegularization) error {
	if reg.ID == uuid.Nil {
		reg.ID = uuid.New()
	}
	reg.CreatedAt = time.Now().UTC()
	if reg.Status == "" {
		reg.Status = "pending"
	}
	query := `
		INSERT INTO hrms_attendance_regularizations (
			id, tenant_id, employee_id, request_type, request_date,
			requested_punch_in, requested_punch_out, reason, status, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.ExecContext(ctx, query,
		reg.ID, reg.TenantID, reg.EmployeeID, reg.RequestType, reg.RequestDate,
		reg.RequestedPunchIn, reg.RequestedPunchOut, reg.Reason, reg.Status, reg.CreatedAt,
	)
	return err
}

func (r *repository) ListRegularizations(ctx context.Context, tenantID uuid.UUID, employeeID *uuid.UUID, status string) ([]AttendanceRegularization, error) {
	where := "WHERE ar.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if employeeID != nil {
		where += fmt.Sprintf(" AND ar.employee_id = $%d", argIdx)
		args = append(args, *employeeID)
		argIdx++
	}

	if status != "" {
		where += fmt.Sprintf(" AND ar.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT ar.*,
		       CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
		       e.employee_code AS employee_code,
		       CONCAT(a.first_name, ' ', a.last_name) AS approver_name
		FROM hrms_attendance_regularizations ar
		JOIN hrms_employees e ON ar.employee_id = e.id
		LEFT JOIN hrms_employees a ON ar.approved_by = a.id
		%s
		ORDER BY ar.created_at DESC
	`, where)

	var list []AttendanceRegularization
	err := r.db.SelectContext(ctx, &list, query, args...)
	return list, err
}

func (r *repository) GetRegularizationByID(ctx context.Context, tenantID, id uuid.UUID) (*AttendanceRegularization, error) {
	query := `
		SELECT ar.*,
		       CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
		       e.employee_code AS employee_code,
		       CONCAT(a.first_name, ' ', a.last_name) AS approver_name
		FROM hrms_attendance_regularizations ar
		JOIN hrms_employees e ON ar.employee_id = e.id
		LEFT JOIN hrms_employees a ON ar.approved_by = a.id
		WHERE ar.tenant_id = $1 AND ar.id = $2
		LIMIT 1
	`
	var reg AttendanceRegularization
	err := r.db.GetContext(ctx, &reg, query, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &reg, nil
}

func (r *repository) UpdateRegularizationStatus(ctx context.Context, tenantID, id, approverID uuid.UUID, status string) (*AttendanceRegularization, error) {
	query := `
		UPDATE hrms_attendance_regularizations
		SET status = $1, approved_by = $2
		WHERE tenant_id = $3 AND id = $4 AND status = 'pending' AND employee_id <> $2
		RETURNING *
	`
	var reg AttendanceRegularization
	err := r.db.GetContext(ctx, &reg, query, status, approverID, tenantID, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errAlreadyDecided
	}
	if err != nil {
		return nil, err
	}
	return &reg, nil
}

func (r *repository) ListDepartments(ctx context.Context, tenantID uuid.UUID) ([]Department, error) {
	query := `SELECT id, tenant_id, name, lead_id, parent_id, created_at FROM hrms_departments WHERE tenant_id = $1 ORDER BY name ASC`
	var depts []Department
	err := r.db.SelectContext(ctx, &depts, query, tenantID)
	return depts, err
}

func (r *repository) CreateDepartment(ctx context.Context, dept *Department) error {
	query := `
		INSERT INTO hrms_departments (id, tenant_id, name, parent_id, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, created_at
	`
	return r.db.QueryRowxContext(ctx, query, dept.ID, dept.TenantID, dept.Name, dept.ParentID).Scan(&dept.ID, &dept.CreatedAt)
}

func (r *repository) ListDesignations(ctx context.Context, tenantID uuid.UUID) ([]Designation, error) {
	query := `SELECT id, tenant_id, title, grade_level, created_at FROM hrms_designations WHERE tenant_id = $1 ORDER BY title ASC`
	var desigs []Designation
	err := r.db.SelectContext(ctx, &desigs, query, tenantID)
	return desigs, err
}

func (r *repository) CreateDesignation(ctx context.Context, desig *Designation) error {
	query := `
		INSERT INTO hrms_designations (id, tenant_id, title, grade_level, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (tenant_id, title) DO UPDATE SET title = EXCLUDED.title
		RETURNING id, created_at
	`
	return r.db.QueryRowxContext(ctx, query, desig.ID, desig.TenantID, desig.Title, desig.GradeLevel).Scan(&desig.ID, &desig.CreatedAt)
}

