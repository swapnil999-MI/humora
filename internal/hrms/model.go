package hrms

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Department represents an organizational unit.
type Department struct {
	ID        uuid.UUID  `db:"id" json:"id"`
	TenantID  uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	Name      string     `db:"name" json:"name"`
	LeadID    *uuid.UUID `db:"lead_id" json:"lead_id,omitempty"`
	ParentID  *uuid.UUID `db:"parent_id" json:"parent_id,omitempty"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
}

// Designation represents a job title and grade level.
type Designation struct {
	ID         uuid.UUID `db:"id" json:"id"`
	TenantID   uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Title      string    `db:"title" json:"title"`
	GradeLevel *string   `db:"grade_level" json:"grade_level,omitempty"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// Employee represents an enterprise workforce member.
type Employee struct {
	ID                  uuid.UUID  `db:"id" json:"id"`
	TenantID            uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	UserID              *uuid.UUID `db:"user_id" json:"user_id,omitempty"`
	EmployeeCode        string     `db:"employee_code" json:"employee_code"`
	FirstName           string     `db:"first_name" json:"first_name"`
	LastName            string     `db:"last_name" json:"last_name"`
	WorkEmail           string     `db:"work_email" json:"work_email"`
	PersonalEmail       *string    `db:"personal_email" json:"personal_email,omitempty"`
	Phone               *string    `db:"phone" json:"phone,omitempty"`
	DepartmentID        *uuid.UUID `db:"department_id" json:"department_id,omitempty"`
	DepartmentName      *string    `db:"department_name" json:"department_name,omitempty"`
	DesignationID       *uuid.UUID `db:"designation_id" json:"designation_id,omitempty"`
	DesignationTitle    *string    `db:"designation_title" json:"designation_title,omitempty"`
	ManagerID           *uuid.UUID `db:"manager_id" json:"manager_id,omitempty"`
	ManagerName         *string    `db:"manager_name" json:"manager_name,omitempty"`
	SecondaryManagerID  *uuid.UUID `db:"secondary_manager_id" json:"secondary_manager_id,omitempty"`
	DateOfJoining       time.Time  `db:"date_of_joining" json:"date_of_joining"`
	DateOfExit          *time.Time `db:"date_of_exit" json:"date_of_exit,omitempty"`
	EmploymentType      string     `db:"employment_type" json:"employment_type"`
	Status              string     `db:"status" json:"status"`
	HourlyCostRate      float64    `db:"hourly_cost_rate" json:"hourly_cost_rate"`
	CustomProfileFields string     `db:"custom_profile_fields" json:"custom_profile_fields"` // JSONB string
	AvatarURL                  *string    `db:"avatar_url" json:"avatar_url,omitempty"`
	BannerURL                  *string    `db:"banner_url" json:"banner_url,omitempty"`
	BiometricFaceURL           *string    `db:"biometric_face_url" json:"biometric_face_url,omitempty"`
	FaceEmbedding              *string    `db:"face_embedding" json:"face_embedding,omitempty"`
	BiometricFaceRegisteredAt  *time.Time `db:"biometric_face_registered_at" json:"biometric_face_registered_at,omitempty"`
	BiometricSampleCount       int        `db:"biometric_sample_count" json:"biometric_sample_count"`
	EffectiveFrom              time.Time  `db:"effective_from" json:"effective_from"`
	EffectiveTo                time.Time  `db:"effective_to" json:"effective_to"`
	CreatedAt                  time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt                  time.Time  `db:"updated_at" json:"updated_at"`
}

// OfficeLocation represents a geofenced corporate workplace.
type OfficeLocation struct {
	ID                 uuid.UUID      `db:"id" json:"id"`
	TenantID           uuid.UUID      `db:"tenant_id" json:"tenant_id"`
	Name               string         `db:"name" json:"name"`
	Latitude           float64        `db:"latitude" json:"latitude"`
	Longitude          float64        `db:"longitude" json:"longitude"`
	RadiusMeters       int            `db:"radius_meters" json:"radius_meters"`
	PolygonCoordinates *string        `db:"polygon_coordinates" json:"polygon_coordinates,omitempty"` // JSON string array of [lat, lng]
	AllowedIPRanges    pq.StringArray `db:"allowed_ip_ranges" json:"allowed_ip_ranges"`
	AllowedWiFiBSSID   pq.StringArray `db:"allowed_wifi_bssid" json:"allowed_wifi_bssid"`
	CreatedAt          time.Time      `db:"created_at" json:"created_at"`
}

// Shift represents daily work schedule bounds and grace periods.
type Shift struct {
	ID                  uuid.UUID `db:"id" json:"id"`
	TenantID            uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Name                string    `db:"name" json:"name"`
	StartTime           string    `db:"start_time" json:"start_time"`
	EndTime             string    `db:"end_time" json:"end_time"`
	GraceMinutes        int       `db:"grace_minutes" json:"grace_minutes"`
	HalfDayHours        float64   `db:"half_day_hours" json:"half_day_hours"`
	FullDayHours        float64   `db:"full_day_hours" json:"full_day_hours"`
	IsNightShift        bool      `db:"is_night_shift" json:"is_night_shift"`
	NightShiftAllowance float64   `db:"night_shift_allowance" json:"night_shift_allowance"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
}

// AttendancePunch represents an in/out biometric, geofenced, or offline punch.
type AttendancePunch struct {
	ID                 uuid.UUID  `db:"id" json:"id"`
	TenantID           uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	EmployeeID         uuid.UUID  `db:"employee_id" json:"employee_id"`
	PunchType          string     `db:"punch_type" json:"punch_type"` // 'in', 'out', 'break_start', 'break_end'
	PunchedAt          time.Time  `db:"punched_at" json:"punched_at"`
	Latitude           *float64   `db:"latitude" json:"latitude,omitempty"`
	Longitude          *float64   `db:"longitude" json:"longitude,omitempty"`
	AccuracyMeters     *float64   `db:"accuracy_meters" json:"accuracy_meters,omitempty"`
	LocationID         *uuid.UUID `db:"location_id" json:"location_id,omitempty"`
	IsGeofenceVerified bool       `db:"is_geofence_verified" json:"is_geofence_verified"`
	IsOfflineSigned    bool       `db:"is_offline_signed" json:"is_offline_signed"`
	OfflineSignature   *string    `db:"offline_signature" json:"offline_signature,omitempty"`
	DeviceInfo         *string    `db:"device_info" json:"device_info,omitempty"`
	Source             string     `db:"source" json:"source"` // 'web', 'android', 'ios', 'biometric'
	IsFaceVerified     bool       `db:"is_face_verified" json:"is_face_verified"`
	FaceConfidence     *float64   `db:"face_confidence" json:"face_confidence,omitempty"`
	FaceDistance       *float64   `db:"face_distance" json:"face_distance,omitempty"`
	SelfieURL          *string    `db:"selfie_url" json:"selfie_url,omitempty"`
	CreatedAt          time.Time  `db:"created_at" json:"created_at"`
}

// LeaveType defines accrual quotas, carry forward, and sandwich rules.
type LeaveType struct {
	ID                    uuid.UUID `db:"id" json:"id"`
	TenantID              uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Name                  string    `db:"name" json:"name"`
	Code                  string    `db:"code" json:"code"` // 'PL', 'SL', 'CL'
	AnnualQuota           float64   `db:"annual_quota" json:"annual_quota"`
	AccrualFrequency      string    `db:"accrual_frequency" json:"accrual_frequency"`
	IsCarryForward        bool      `db:"is_carry_forward" json:"is_carry_forward"`
	MaxCarryForward       float64   `db:"max_carry_forward" json:"max_carry_forward"`
	IsSandwichRuleEnabled bool      `db:"is_sandwich_rule_enabled" json:"is_sandwich_rule_enabled"`
	CreatedAt             time.Time `db:"created_at" json:"created_at"`
}

// LeaveBalance tracks annual quota, used days, and remaining credits.
type LeaveBalance struct {
	ID            uuid.UUID `db:"id" json:"id"`
	TenantID      uuid.UUID `db:"tenant_id" json:"tenant_id"`
	EmployeeID    uuid.UUID `db:"employee_id" json:"employee_id"`
	LeaveTypeID   uuid.UUID `db:"leave_type_id" json:"leave_type_id"`
	LeaveTypeName string    `db:"leave_type_name" json:"leave_type_name"`
	LeaveTypeCode string    `db:"leave_type_code" json:"leave_type_code"`
	Balance       float64   `db:"balance" json:"balance"`
	Credited      float64   `db:"credited" json:"credited"`
	Used          float64   `db:"used" json:"used"`
	Year          int       `db:"year" json:"year"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// LeaveRequest represents an employee absence application.
type LeaveRequest struct {
	ID                   uuid.UUID  `db:"id" json:"id"`
	TenantID             uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	EmployeeID           uuid.UUID  `db:"employee_id" json:"employee_id"`
	EmployeeName         *string    `db:"employee_name" json:"employee_name,omitempty"`
	LeaveTypeID          uuid.UUID  `db:"leave_type_id" json:"leave_type_id"`
	LeaveTypeName        *string    `db:"leave_type_name" json:"leave_type_name,omitempty"`
	FromDate             time.Time  `db:"from_date" json:"from_date"`
	ToDate               time.Time  `db:"to_date" json:"to_date"`
	TotalDays            float64    `db:"total_days" json:"total_days"`
	SandwichDaysAdded    float64    `db:"sandwich_days_added" json:"sandwich_days_added"`
	Reason               string     `db:"reason" json:"reason"`
	Status               string     `db:"status" json:"status"` // 'pending', 'approved', 'rejected'
	CurrentApprovalLevel int        `db:"current_approval_level" json:"current_approval_level"`
	ApprovedBy           *uuid.UUID `db:"approved_by" json:"approved_by,omitempty"`
	CreatedAt            time.Time  `db:"created_at" json:"created_at"`
}

// PublicHoliday represents mandatory corporate non-working days.
type PublicHoliday struct {
	ID          uuid.UUID `db:"id" json:"id"`
	TenantID    uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	HolidayDate time.Time `db:"holiday_date" json:"holiday_date"`
	IsMandatory bool      `db:"is_mandatory" json:"is_mandatory"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// ShiftRoster records the effective assignment of an employee to a shift.
type ShiftRoster struct {
	ID            uuid.UUID `db:"id" json:"id"`
	TenantID      uuid.UUID `db:"tenant_id" json:"tenant_id"`
	EmployeeID    uuid.UUID `db:"employee_id" json:"employee_id"`
	ShiftID       uuid.UUID `db:"shift_id" json:"shift_id"`
	EffectiveDate time.Time `db:"effective_date" json:"effective_date"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// EmployeeShiftRosterView joins employee details with their active shift assignment.
type EmployeeShiftRosterView struct {
	EmployeeID     uuid.UUID  `db:"employee_id" json:"employee_id"`
	EmployeeCode   string     `db:"employee_code" json:"employee_code"`
	FirstName      string     `db:"first_name" json:"first_name"`
	LastName       string     `db:"last_name" json:"last_name"`
	WorkEmail      string     `db:"work_email" json:"work_email"`
	DepartmentName *string    `db:"department_name" json:"department_name,omitempty"`
	AvatarURL      *string    `db:"avatar_url" json:"avatar_url,omitempty"`
	ShiftID        *uuid.UUID `db:"shift_id" json:"shift_id,omitempty"`
	ShiftName      *string    `db:"shift_name" json:"shift_name,omitempty"`
	StartTime      *string    `db:"start_time" json:"start_time,omitempty"`
	EndTime        *string    `db:"end_time" json:"end_time,omitempty"`
	GraceMinutes   *int       `db:"grace_minutes" json:"grace_minutes,omitempty"`
	EffectiveDate  *time.Time `db:"effective_date" json:"effective_date,omitempty"`
}

// AttendanceRegularization represents an employee's request to correct attendance or log On-Duty/WFH.
type AttendanceRegularization struct {
	ID                uuid.UUID  `db:"id" json:"id"`
	TenantID          uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	EmployeeID        uuid.UUID  `db:"employee_id" json:"employee_id"`
	EmployeeName      *string    `db:"employee_name" json:"employee_name,omitempty"`
	EmployeeCode      *string    `db:"employee_code" json:"employee_code,omitempty"`
	RequestType       string     `db:"request_type" json:"request_type"` // 'missed_punch', 'on_duty', 'wfh'
	RequestDate       time.Time  `db:"request_date" json:"request_date"`
	RequestedPunchIn  *time.Time `db:"requested_punch_in" json:"requested_punch_in,omitempty"`
	RequestedPunchOut *time.Time `db:"requested_punch_out" json:"requested_punch_out,omitempty"`
	Reason            string     `db:"reason" json:"reason"`
	Status            string     `db:"status" json:"status"` // 'pending', 'approved', 'rejected'
	ApprovedBy        *uuid.UUID `db:"approved_by" json:"approved_by,omitempty"`
	ApproverName      *string    `db:"approver_name" json:"approver_name,omitempty"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
}

// CompensationStructure stores employee CTC components.
type CompensationStructure struct {
	ID               uuid.UUID `db:"id" json:"id"`
	TenantID         uuid.UUID `db:"tenant_id" json:"tenant_id"`
	EmployeeID       uuid.UUID `db:"employee_id" json:"employee_id"`
	Basic            float64   `db:"basic" json:"basic"`
	HRA              float64   `db:"hra" json:"hra"`
	SpecialAllowance float64   `db:"special_allowance" json:"special_allowance"`
	ProvidentFund    float64   `db:"provident_fund" json:"provident_fund"`
	ProfessionalTax  float64   `db:"professional_tax" json:"professional_tax"`
	EffectiveDate    time.Time `db:"effective_date" json:"effective_date"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
	// Derived fields for frontend display
	AnnualCTC    float64 `db:"-" json:"annual_ctc"`
	MonthlyGross float64 `db:"-" json:"monthly_gross"`
	EmployerPF   float64 `db:"-" json:"employer_pf"`
	Gratuity     float64 `db:"-" json:"gratuity"`
	NetTakeHome  float64 `db:"-" json:"net_take_home"`
}

// PayrollRun represents a monthly payroll batch execution.
type PayrollRun struct {
	ID              uuid.UUID  `db:"id" json:"id"`
	TenantID        uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	Month           int        `db:"month" json:"month"`
	Year            int        `db:"year" json:"year"`
	Status          string     `db:"status" json:"status"` // 'draft', 'processing', 'completed'
	TotalEmployees  int        `db:"total_employees" json:"total_employees"`
	TotalGross      float64    `db:"total_gross" json:"total_gross"`
	TotalDeductions float64    `db:"total_deductions" json:"total_deductions"`
	TotalNet        float64    `db:"total_net" json:"total_net"`
	ProcessedBy     *uuid.UUID `db:"processed_by" json:"processed_by,omitempty"`
	ProcessedByName *string    `db:"processed_by_name" json:"processed_by_name,omitempty"`
	ProcessedAt     *time.Time `db:"processed_at" json:"processed_at,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
}

// Payslip represents an itemized monthly official payslip.
type Payslip struct {
	ID                 uuid.UUID  `db:"id" json:"id"`
	TenantID           uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	PayrollRunID       *uuid.UUID `db:"payroll_run_id" json:"payroll_run_id,omitempty"`
	EmployeeID         uuid.UUID  `db:"employee_id" json:"employee_id"`
	EmployeeName       string     `db:"employee_name" json:"employee_name"`
	EmployeeCode       string     `db:"employee_code" json:"employee_code"`
	DesignationTitle   string     `db:"designation_title" json:"designation_title"`
	DepartmentName     string     `db:"department_name" json:"department_name"`
	DateOfJoining      *time.Time `db:"date_of_joining" json:"date_of_joining,omitempty"`
	BankName           string     `db:"bank_name" json:"bank_name"`
	BankAccountMasked string     `db:"bank_account_masked" json:"bank_account_masked"`
	BankIFSC           string     `db:"bank_ifsc" json:"bank_ifsc"`
	PAN                string     `db:"pan" json:"pan"`
	UAN                string     `db:"uan" json:"uan"`
	Month              int        `db:"month" json:"month"`
	Year               int        `db:"year" json:"year"`
	PayPeriod          string     `db:"pay_period" json:"pay_period"`
	PaymentDate        *time.Time `db:"payment_date" json:"payment_date,omitempty"`
	Status             string     `db:"status" json:"status"` // 'paid', 'processing', 'hold'
	TotalDays          int        `db:"total_days" json:"total_days"`
	PayableDays        float64    `db:"payable_days" json:"payable_days"`
	LOPDays            float64    `db:"lop_days" json:"lop_days"`
	// Itemized Earnings
	Basic            float64 `db:"basic" json:"basic"`
	HRA              float64 `db:"hra" json:"hra"`
	Conveyance       float64 `db:"conveyance" json:"conveyance"`
	MedicalAllowance float64 `db:"medical_allowance" json:"medical_allowance"`
	SpecialAllowance float64 `db:"special_allowance" json:"special_allowance"`
	Bonus            float64 `db:"bonus" json:"bonus"`
	GrossEarnings    float64 `db:"gross_earnings" json:"gross_earnings"`
	// Itemized Deductions
	ProvidentFund   float64 `db:"provident_fund" json:"provident_fund"`
	ProfessionalTax float64 `db:"professional_tax" json:"professional_tax"`
	TDS             float64 `db:"tds" json:"tds"`
	LOPDeduction    float64 `db:"lop_deduction" json:"lop_deduction"`
	OtherDeductions float64 `db:"other_deductions" json:"other_deductions"`
	TotalDeductions float64 `db:"total_deductions" json:"total_deductions"`
	// Net Pay
	NetPay        float64 `db:"net_pay" json:"net_pay"`
	NetPayInWords string  `db:"net_pay_in_words" json:"net_pay_in_words"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// ITDeclaration represents employee's income tax regime and deduction declarations.
type ITDeclaration struct {
	ID                     uuid.UUID `db:"id" json:"id"`
	TenantID               uuid.UUID `db:"tenant_id" json:"tenant_id"`
	EmployeeID             uuid.UUID `db:"employee_id" json:"employee_id"`
	FinancialYear          string    `db:"financial_year" json:"financial_year"`
	Regime                 string    `db:"regime" json:"regime"` // 'new', 'old'
	Sec80CTotal            float64   `db:"sec_80c_total" json:"sec_80c_total"`
	Sec80DHealthInsurance  float64   `db:"sec_80d_health_insurance" json:"sec_80d_health_insurance"`
	Sec80DParents          float64   `db:"sec_80d_parents" json:"sec_80d_parents"`
	HRAAnnualRentPaid      float64   `db:"hra_annual_rent_paid" json:"hra_annual_rent_paid"`
	HRALandlordPAN         *string   `db:"hra_landlord_pan" json:"hra_landlord_pan,omitempty"`
	HomeLoanInterest       float64   `db:"home_loan_interest" json:"home_loan_interest"`
	NPSContribution        float64   `db:"nps_contribution" json:"nps_contribution"`
	ProjectedAnnualTax     float64   `db:"projected_annual_tax" json:"projected_annual_tax"`
	MonthlyTDS             float64   `db:"monthly_tds" json:"monthly_tds"`
	CreatedAt              time.Time `db:"created_at" json:"created_at"`
	UpdatedAt              time.Time `db:"updated_at" json:"updated_at"`
}

// ReimbursementClaim represents an expense or flexible benefit claim.
type ReimbursementClaim struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	TenantID     uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	EmployeeID   uuid.UUID  `db:"employee_id" json:"employee_id"`
	Category     string     `db:"category" json:"category"` // 'broadband', 'learning', 'travel', 'wellness', 'office_supplies'
	CategoryName string     `db:"category_name" json:"category_name"`
	Amount       float64    `db:"amount" json:"amount"`
	BillNumber   *string    `db:"bill_number" json:"bill_number,omitempty"`
	BillDate     time.Time  `db:"bill_date" json:"bill_date"`
	MerchantName string     `db:"merchant_name" json:"merchant_name"`
	Description  *string    `db:"description" json:"description,omitempty"`
	ReceiptURL   *string    `db:"receipt_url" json:"receipt_url,omitempty"`
	Status       string     `db:"status" json:"status"` // 'pending', 'approved', 'rejected', 'reimbursed'
	ReviewerName *string    `db:"reviewer_name" json:"reviewer_name,omitempty"`
	ReviewedBy   *uuid.UUID `db:"reviewed_by" json:"reviewed_by,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}

