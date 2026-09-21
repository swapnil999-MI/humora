package hrms

import (
	"strings"
	"time"
)

// CreateEmployeeRequest holds required attributes for onboarding a team member.
type CreateEmployeeRequest struct {
	EmployeeCode        string    `json:"employee_code"`
	FirstName           string    `json:"first_name"`
	LastName            string    `json:"last_name"`
	WorkEmail           string    `json:"work_email"`
	PersonalEmail       *string   `json:"personal_email,omitempty"`
	Phone               *string   `json:"phone,omitempty"`
	DepartmentID        *string   `json:"department_id,omitempty"`
	DesignationID       *string   `json:"designation_id,omitempty"`
	ManagerID           *string   `json:"manager_id,omitempty"`
	DateOfJoining       string    `json:"date_of_joining"` // YYYY-MM-DD
	EmploymentType      string    `json:"employment_type"` // 'full_time', 'contract', 'intern'
	HourlyCostRate      float64   `json:"hourly_cost_rate"`
	CustomProfileFields string    `json:"custom_profile_fields,omitempty"`
}

func (r *CreateEmployeeRequest) Validate() string {
	if strings.TrimSpace(r.EmployeeCode) == "" {
		return "employee_code is required"
	}
	if strings.TrimSpace(r.FirstName) == "" {
		return "first_name is required"
	}
	if strings.TrimSpace(r.WorkEmail) == "" || !strings.Contains(r.WorkEmail, "@") {
		return "valid work_email is required"
	}
	if strings.TrimSpace(r.DateOfJoining) == "" {
		return "date_of_joining (YYYY-MM-DD) is required"
	}
	return ""
}

// OrgNode represents an employee node in the interactive visual org chart tree.
type OrgNode struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Title            string    `json:"title"`
	Department       string    `json:"department"`
	Email            string    `json:"email"`
	PresenceStatus   string    `json:"presence_status"`
	DirectReportCount int      `json:"direct_report_count"`
	Children         []OrgNode `json:"children"`
}

// PunchRequest holds geolocation and biometric telemetry for attendance punches.
type PunchRequest struct {
	PunchType        string   `json:"punch_type"` // 'in', 'out', 'break_start', 'break_end'
	Latitude         *float64 `json:"latitude,omitempty"`
	Longitude        *float64 `json:"longitude,omitempty"`
	AccuracyMeters   *float64 `json:"accuracy_meters,omitempty"`
	LocationID       *string  `json:"location_id,omitempty"`
	WiFiBSSID        string   `json:"wifi_bssid,omitempty"`
	OfflineSignature string   `json:"offline_signature,omitempty"`
	PunchedAt        *string  `json:"punched_at,omitempty"` // RFC3339 for offline queued punches
	Source           string   `json:"source"`               // 'web', 'android', 'ios'
}

func (r *PunchRequest) Validate() string {
	if r.PunchType != "in" && r.PunchType != "out" && r.PunchType != "break_start" && r.PunchType != "break_end" {
		return "invalid punch_type: must be 'in', 'out', 'break_start', or 'break_end'"
	}
	return ""
}

// PunchResponse describes the verification outcome of a punch event.
type PunchResponse struct {
	ID                 string    `json:"id"`
	PunchType          string    `json:"punch_type"`
	PunchedAt          time.Time `json:"punched_at"`
	IsGeofenceVerified bool      `json:"is_geofence_verified"`
	IsOfflineSigned    bool      `json:"is_offline_signed"`
	Message            string    `json:"message"`
}

// EnrollBiometricFaceRequest holds 1 to 5 images for employee master face enrollment.
type EnrollBiometricFaceRequest struct {
	Images []string `json:"images"` // 1 to 5 Base64 data URLs or raw base64 images
}

func (r *EnrollBiometricFaceRequest) Validate() string {
	if len(r.Images) == 0 {
		return "at least one face image is required for enrollment"
	}
	if len(r.Images) > 5 {
		return "a maximum of 5 images can be submitted for multi-shot enrollment"
	}
	return ""
}

// EnrollBiometricFaceResponse returns outcome of reference face enrollment.
type EnrollBiometricFaceResponse struct {
	EmployeeID  string `json:"employee_id"`
	FaceURL     string `json:"face_url"`
	SampleCount int    `json:"sample_count"`
	EnrolledAt  string `json:"enrolled_at"`
	Message     string `json:"message"`
}

// PunchWithFaceRequest holds camera selfie image and punch telemetry.
type PunchWithFaceRequest struct {
	PunchType      string   `json:"punch_type"` // 'in', 'out', 'break_start', 'break_end'
	SelfieImage    string   `json:"selfie_image"`
	Latitude       *float64 `json:"latitude,omitempty"`
	Longitude      *float64 `json:"longitude,omitempty"`
	AccuracyMeters *float64 `json:"accuracy_meters,omitempty"`
	LocationID     *string  `json:"location_id,omitempty"`
	DeviceInfo     *string  `json:"device_info,omitempty"`
	Source         string   `json:"source"` // 'web', 'android', 'ios'
}

func (r *PunchWithFaceRequest) Validate() string {
	if r.PunchType != "in" && r.PunchType != "out" && r.PunchType != "break_start" && r.PunchType != "break_end" {
		return "invalid punch_type: must be 'in', 'out', 'break_start', or 'break_end'"
	}
	if strings.TrimSpace(r.SelfieImage) == "" {
		return "selfie_image is required for biometric face verification"
	}
	return ""
}

// PunchWithFaceResponse provides detailed biometric verification and punch outcome.
type PunchWithFaceResponse struct {
	ID                 string    `json:"id"`
	PunchType          string    `json:"punch_type"`
	PunchedAt          time.Time `json:"punched_at"`
	IsFaceVerified     bool      `json:"is_face_verified"`
	FaceConfidence     float64   `json:"face_confidence"`
	FaceDistance       float32   `json:"face_distance"`
	SelfieURL          string    `json:"selfie_url,omitempty"`
	IsGeofenceVerified bool      `json:"is_geofence_verified"`
	Message            string    `json:"message"`
}

// ApplyLeaveRequest parameters.
type ApplyLeaveRequest struct {
	LeaveTypeID string `json:"leave_type_id"`
	FromDate    string `json:"from_date"` // YYYY-MM-DD
	ToDate      string `json:"to_date"`   // YYYY-MM-DD
	Reason      string `json:"reason"`
}

func (r *ApplyLeaveRequest) Validate() string {
	if strings.TrimSpace(r.LeaveTypeID) == "" {
		return "leave_type_id is required"
	}
	if strings.TrimSpace(r.FromDate) == "" || strings.TrimSpace(r.ToDate) == "" {
		return "from_date and to_date (YYYY-MM-DD) are required"
	}
	return ""
}

// LeavePreviewResponse outlines sandwich days before application.
type LeavePreviewResponse struct {
	FromDate          string  `json:"from_date"`
	ToDate            string  `json:"to_date"`
	WorkingDays       float64 `json:"working_days"`
	SandwichDaysAdded float64 `json:"sandwich_days_added"`
	TotalDeductedDays float64 `json:"total_deducted_days"`
	CurrentBalance    float64 `json:"current_balance"`
	ProjectedBalance  float64 `json:"projected_balance"`
	SandwichRuleActive bool   `json:"sandwich_rule_active"`
}

// AttendanceSummaryResponse provides dashboard status.
type AttendanceSummaryResponse struct {
	PunchedIn      bool       `json:"punched_in"`
	LastPunchType  string     `json:"last_punch_type"`
	LastPunchTime  *time.Time `json:"last_punch_time,omitempty"`
	TodayHours     float64    `json:"today_hours"`
	PresenceStatus string     `json:"presence_status"`
	ShiftName      string     `json:"shift_name"`
}

// AttendanceSessionResponse provides live high-frequency session state for the punch desk terminal.
type AttendanceSessionResponse struct {
	EmployeeID     string            `json:"employee_id"`
	CurrentState   string            `json:"current_state"` // 'out', 'working', 'on_break'
	Shift          *Shift            `json:"shift,omitempty"`
	FirstPunchIn   *time.Time        `json:"first_punch_in,omitempty"`
	LastPunchTime  *time.Time        `json:"last_punch_time,omitempty"`
	LastPunchType  string            `json:"last_punch_type"`
	ActiveWorkSecs int64             `json:"active_work_seconds"`
	BreakSecs      int64             `json:"break_seconds"`
	IsLateIn       bool              `json:"is_late_in"`
	TodayPunches   []AttendancePunch `json:"today_punches"`
}

// MonthlyAttendanceDay provides daily breakdown for calendar matrix.
type MonthlyAttendanceDay struct {
	Date             string            `json:"date"`         // YYYY-MM-DD
	DayOfWeek        string            `json:"day_of_week"`  // Monday, Tuesday...
	Status           string            `json:"status"`       // 'present', 'half_day', 'absent', 'leave', 'holiday', 'weekend', 'regularized'
	StatusLabel      string            `json:"status_label"`
	FirstPunchIn     *time.Time        `json:"first_punch_in,omitempty"`
	LastPunchOut     *time.Time        `json:"last_punch_out,omitempty"`
	WorkHours        float64           `json:"work_hours"`
	BreakHours       float64           `json:"break_hours"`
	ExpectedHours    float64           `json:"expected_hours"`
	IsLateIn         bool              `json:"is_late_in"`
	ShiftName        string            `json:"shift_name"`
	LeaveDetails     *string           `json:"leave_details,omitempty"`
	RegularizationID *string           `json:"regularization_id,omitempty"`
	CanRegularize    bool              `json:"can_regularize"`
	Punches          []AttendancePunch `json:"punches"`
}

// MonthlyAttendanceResponse wraps the visual monthly grid and summary metrics.
type MonthlyAttendanceResponse struct {
	Year             int                    `json:"year"`
	Month            int                    `json:"month"`
	Days             []MonthlyAttendanceDay `json:"days"`
	TotalPresent     float64                `json:"total_present"`
	TotalHalfDays    int                    `json:"total_half_days"`
	TotalAbsent      int                    `json:"total_absent"`
	TotalLeaves      float64                `json:"total_leaves"`
	TotalHolidays    int                    `json:"total_holidays"`
	TotalWorkHours   float64                `json:"total_work_hours"`
	AverageWorkHours float64                `json:"average_work_hours"`
}

// TeamPresenceRadarMember represents a colleague's real-time attendance status.
type TeamPresenceRadarMember struct {
	EmployeeID     string     `json:"employee_id"`
	EmployeeCode   string     `json:"employee_code"`
	FirstName      string     `json:"first_name"`
	LastName       string     `json:"last_name"`
	WorkEmail      string     `json:"work_email"`
	DepartmentName *string    `json:"department_name,omitempty"`
	AvatarURL      *string    `json:"avatar_url,omitempty"`
	PresenceStatus string     `json:"presence_status"` // 'working', 'on_break', 'late_in', 'on_leave', 'absent', 'not_punched'
	FirstPunchIn   *time.Time `json:"first_punch_in,omitempty"`
	LastPunchTime  *time.Time `json:"last_punch_time,omitempty"`
	ActiveWorkSecs int64      `json:"active_work_seconds"`
	ShiftName      string     `json:"shift_name"`
}

// CreateShiftRequest holds parameters for creating/updating a corporate shift.
type CreateShiftRequest struct {
	Name                string  `json:"name"`
	StartTime           string  `json:"start_time"` // "09:00:00" or "09:00"
	EndTime             string  `json:"end_time"`   // "18:00:00" or "18:00"
	GraceMinutes        int     `json:"grace_minutes"`
	HalfDayHours        float64 `json:"half_day_hours"`
	FullDayHours        float64 `json:"full_day_hours"`
	IsNightShift        bool    `json:"is_night_shift"`
	NightShiftAllowance float64 `json:"night_shift_allowance"`
}

func (r *CreateShiftRequest) Validate() string {
	if strings.TrimSpace(r.Name) == "" {
		return "shift name is required"
	}
	if strings.TrimSpace(r.StartTime) == "" || strings.TrimSpace(r.EndTime) == "" {
		return "start_time and end_time are required"
	}
	if r.HalfDayHours <= 0 {
		r.HalfDayHours = 4.5
	}
	if r.FullDayHours <= 0 {
		r.FullDayHours = 8.0
	}
	return ""
}

// AssignShiftRequest assigns an employee to a shift starting on effective_date.
type AssignShiftRequest struct {
	EmployeeID    string `json:"employee_id"`
	ShiftID       string `json:"shift_id"`
	EffectiveDate string `json:"effective_date"` // YYYY-MM-DD
}

// BulkAssignShiftRequest assigns multiple employees to a shift.
type BulkAssignShiftRequest struct {
	EmployeeIDs   []string `json:"employee_ids"`
	ShiftID       string   `json:"shift_id"`
	EffectiveDate string   `json:"effective_date"` // YYYY-MM-DD
}

// CreateRegularizationRequest represents an attendance regularization or OD application.
type CreateRegularizationRequest struct {
	RequestType       string  `json:"request_type"` // 'missed_punch', 'on_duty', 'wfh'
	RequestDate       string  `json:"request_date"` // YYYY-MM-DD
	RequestedPunchIn  *string `json:"requested_punch_in,omitempty"`
	RequestedPunchOut *string `json:"requested_punch_out,omitempty"`
	Reason            string  `json:"reason"`
}

func (r *CreateRegularizationRequest) Validate() string {
	if r.RequestType != "missed_punch" && r.RequestType != "on_duty" && r.RequestType != "wfh" {
		return "invalid request_type: must be 'missed_punch', 'on_duty', or 'wfh'"
	}
	if strings.TrimSpace(r.RequestDate) == "" {
		return "request_date (YYYY-MM-DD) is required"
	}
	if strings.TrimSpace(r.Reason) == "" {
		return "reason is required"
	}
	return ""
}

// ReviewRegularizationRequest handles approving or rejecting regularizations.
type ReviewRegularizationRequest struct {
	Status string `json:"status"` // 'approved', 'rejected'
}

