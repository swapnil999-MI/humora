package hrms

import (
	"strconv"
	"humora-backend/internal/notify"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"log"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"

	"humora-backend/pkg/biometrics"
	"humora-backend/pkg/media"

	"github.com/google/uuid"
)

func saveBiometricDebugImage(prefix, empID string, img image.Image) string {
	// Raw face images are biometric PII: only dump them when explicitly enabled for local debugging.
	if img == nil || os.Getenv("BIOMETRIC_DEBUG_DUMP") != "true" {
		return ""
	}
	debugDir := "storage/debug_biometrics"
	if err := os.MkdirAll(debugDir, 0700); err != nil {
		return ""
	}
	filename := fmt.Sprintf("%s_%s_%d.jpg", prefix, empID, time.Now().UnixNano()/1000000)
	filePath := filepath.Join(debugDir, filename)
	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return ""
	}
	defer f.Close()
	if err := jpeg.Encode(f, img, &jpeg.Options{Quality: 90}); err != nil {
		return ""
	}
	return filePath
}

type Service interface {
	CreateEmployee(ctx context.Context, tenantID uuid.UUID, req *CreateEmployeeRequest) (*Employee, error)
	GetEmployee(ctx context.Context, tenantID, id uuid.UUID) (*Employee, error)
	GetEmployeeByUserID(ctx context.Context, tenantID, userID uuid.UUID) (*Employee, error)
	ListEmployees(ctx context.Context, tenantID uuid.UUID, search, deptID string, limit, offset int) ([]Employee, int64, error)
	GetOrgTree(ctx context.Context, tenantID uuid.UUID) ([]OrgNode, error)

	GetAttendanceSummary(ctx context.Context, tenantID, userID uuid.UUID) (*AttendanceSummaryResponse, error)

	// Biometric Face Verification & Punching
	UpdateEmployeeBiometricFace(ctx context.Context, tenantID, employeeID uuid.UUID, req *EnrollBiometricFaceRequest) (*EnrollBiometricFaceResponse, error)
	PunchWithFace(ctx context.Context, tenantID, userID uuid.UUID, req *PunchWithFaceRequest) (*PunchWithFaceResponse, error)
	GetPunchDevice(ctx context.Context, tenantID, userID uuid.UUID) (*PunchDeviceStatus, error)
	RegisterPunchDevice(ctx context.Context, tenantID, userID uuid.UUID, req *RegisterPunchDeviceRequest) (*PunchDeviceStatus, error)
	IssuePunchChallenge(ctx context.Context, tenantID, userID uuid.UUID, punchType string) (*PunchChallengeResponse, error)
	IssueDeviceRegistrationChallenge(ctx context.Context, tenantID, userID uuid.UUID) (*PunchChallengeResponse, error)
	PunchWithFingerprint(ctx context.Context, tenantID, userID uuid.UUID, req *PunchWithFingerprintRequest) (*PunchWithFingerprintResponse, error)
	ListFingerprintAccess(ctx context.Context, tenantID uuid.UUID) ([]PunchDevice, error)
	AllowFingerprint(ctx context.Context, tenantID, employeeID, adminUserID uuid.UUID) error
	RemoveFingerprint(ctx context.Context, tenantID, employeeID uuid.UUID) error
	DeleteEmployeeFace(ctx context.Context, tenantID, employeeID uuid.UUID) error

	PreviewLeave(ctx context.Context, tenantID, userID uuid.UUID, req *ApplyLeaveRequest) (*LeavePreviewResponse, error)
	ApplyLeave(ctx context.Context, tenantID, userID uuid.UUID, req *ApplyLeaveRequest) (*LeaveRequest, error)
	ApproveOrRejectLeave(ctx context.Context, tenantID, requestID, approverUserID uuid.UUID, status string) (*LeaveRequest, error)
	ListMyLeaves(ctx context.Context, tenantID, userID uuid.UUID, limit, offset int) ([]LeaveRequest, int64, error)
	ListAllLeaveRequests(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]LeaveRequest, int64, error)
	ListLeaveBalances(ctx context.Context, tenantID, userID uuid.UUID) ([]LeaveBalance, error)
	ListLeaveTypes(ctx context.Context, tenantID uuid.UUID) ([]LeaveType, error)

	// Shifts & Rosters
	CreateShift(ctx context.Context, tenantID uuid.UUID, req *CreateShiftRequest) (*Shift, error)
	ListShifts(ctx context.Context, tenantID uuid.UUID) ([]Shift, error)
	UpdateShift(ctx context.Context, tenantID, shiftID uuid.UUID, req *CreateShiftRequest) (*Shift, error)
	DeleteShift(ctx context.Context, tenantID, shiftID uuid.UUID) error
	AssignShift(ctx context.Context, tenantID uuid.UUID, req *AssignShiftRequest) error
	BulkAssignShift(ctx context.Context, tenantID uuid.UUID, req *BulkAssignShiftRequest) error
	ListEmployeeRosters(ctx context.Context, tenantID uuid.UUID) ([]EmployeeShiftRosterView, error)

	// Live Session, Monthly Attendance Matrix & Radar
	GetAttendanceSession(ctx context.Context, tenantID, userID uuid.UUID) (*AttendanceSessionResponse, error)
	GetMonthlyAttendance(ctx context.Context, tenantID, userID uuid.UUID, year, month int) (*MonthlyAttendanceResponse, error)
	GetTeamPresenceRadar(ctx context.Context, tenantID uuid.UUID) ([]TeamPresenceRadarMember, error)

	// Attendance Regularization & OD
	CreateRegularization(ctx context.Context, tenantID, userID uuid.UUID, req *CreateRegularizationRequest) (*AttendanceRegularization, error)
	ListMyRegularizations(ctx context.Context, tenantID, userID uuid.UUID, status string) ([]AttendanceRegularization, error)
	ListTeamRegularizations(ctx context.Context, tenantID uuid.UUID, status string) ([]AttendanceRegularization, error)
	ReviewRegularization(ctx context.Context, tenantID, regID, reviewerUserID uuid.UUID, req *ReviewRegularizationRequest) (*AttendanceRegularization, error)

	// Office Geofenced Locations
	ListOfficeLocations(ctx context.Context, tenantID uuid.UUID) ([]OfficeLocation, error)
	GetOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID) (*OfficeLocation, error)
	CreateOfficeLocation(ctx context.Context, tenantID uuid.UUID, req *CreateOfficeLocationRequest) (*OfficeLocation, error)
	UpdateOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID, req *UpdateOfficeLocationRequest) (*OfficeLocation, error)
	DeleteOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID) error

	// Departments & Designations
	ListDepartments(ctx context.Context, tenantID uuid.UUID) ([]Department, error)
	CreateDepartment(ctx context.Context, tenantID uuid.UUID, name string) (*Department, error)
	ListDesignations(ctx context.Context, tenantID uuid.UUID) ([]Designation, error)
	CreateDesignation(ctx context.Context, tenantID uuid.UUID, title string) (*Designation, error)
}

type service struct {
	repo     Repository
	embedder biometrics.FaceEmbedder
}

func NewService(repo Repository) Service {
	return &service{
		repo:     repo,
		embedder: biometrics.NewFaceEmbedder(""),
	}
}

func NewServiceWithEmbedder(repo Repository, embedder biometrics.FaceEmbedder) Service {
	return &service{
		repo:     repo,
		embedder: embedder,
	}
}

func (s *service) CreateEmployee(ctx context.Context, tenantID uuid.UUID, req *CreateEmployeeRequest) (*Employee, error) {
	if validationErr := req.Validate(); validationErr != "" {
		return nil, errors.New(validationErr)
	}

	dateOfJoining, err := time.Parse("2006-01-02", req.DateOfJoining)
	if err != nil {
		return nil, fmt.Errorf("invalid date_of_joining format (expected YYYY-MM-DD): %w", err)
	}

	emp := &Employee{
		ID:             uuid.New(),
		TenantID:       tenantID,
		EmployeeCode:   strings.TrimSpace(req.EmployeeCode),
		FirstName:      strings.TrimSpace(req.FirstName),
		LastName:       strings.TrimSpace(req.LastName),
		WorkEmail:      strings.ToLower(strings.TrimSpace(req.WorkEmail)),
		PersonalEmail:  req.PersonalEmail,
		Phone:          req.Phone,
		DateOfJoining:  dateOfJoining,
		EmploymentType: req.EmploymentType,
		Status:         "active",
		HourlyCostRate: req.HourlyCostRate,
	}

	if req.DepartmentID != nil && *req.DepartmentID != "" {
		if deptUUID, err := uuid.Parse(*req.DepartmentID); err == nil {
			emp.DepartmentID = &deptUUID
		}
	}
	if req.DesignationID != nil && *req.DesignationID != "" {
		if desigUUID, err := uuid.Parse(*req.DesignationID); err == nil {
			emp.DesignationID = &desigUUID
		}
	}
	if req.ManagerID != nil && *req.ManagerID != "" {
		if mgrUUID, err := uuid.Parse(*req.ManagerID); err == nil {
			emp.ManagerID = &mgrUUID
		}
	}
	if req.CustomProfileFields != "" {
		emp.CustomProfileFields = req.CustomProfileFields
	}

	if err := s.repo.CreateEmployee(ctx, emp); err != nil {
		return nil, fmt.Errorf("failed to create employee: %w", err)
	}

	return emp, nil
}

func (s *service) GetEmployee(ctx context.Context, tenantID, id uuid.UUID) (*Employee, error) {
	return s.repo.GetEmployeeByID(ctx, tenantID, id)
}

func (s *service) GetEmployeeByUserID(ctx context.Context, tenantID, userID uuid.UUID) (*Employee, error) {
	return s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
}

func (s *service) ListEmployees(ctx context.Context, tenantID uuid.UUID, search, deptID string, limit, offset int) ([]Employee, int64, error) {
	return s.repo.ListEmployees(ctx, tenantID, search, deptID, limit, offset)
}

func (s *service) GetOrgTree(ctx context.Context, tenantID uuid.UUID) ([]OrgNode, error) {
	employees, err := s.repo.GetOrgHierarchy(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Build parent -> children map
	treeMap := make(map[string][]OrgNode)
	var rootNodes []OrgNode

	for _, emp := range employees {
		dept := ""
		if emp.DepartmentName != nil {
			dept = *emp.DepartmentName
		}
		title := ""
		if emp.DesignationTitle != nil {
			title = *emp.DesignationTitle
		}

		node := OrgNode{
			ID:             emp.ID.String(),
			Name:           fmt.Sprintf("%s %s", emp.FirstName, emp.LastName),
			Title:          title,
			Department:     dept,
			Email:          emp.WorkEmail,
			PresenceStatus: emp.Status,
			Children:       []OrgNode{},
		}

		if emp.ManagerID == nil || *emp.ManagerID == uuid.Nil {
			rootNodes = append(rootNodes, node)
		} else {
			mgrID := emp.ManagerID.String()
			treeMap[mgrID] = append(treeMap[mgrID], node)
		}
	}

	// Recursive builder
	var buildTree func(node *OrgNode)
	buildTree = func(node *OrgNode) {
		children := treeMap[node.ID]
		node.DirectReportCount = len(children)
		for i := range children {
			buildTree(&children[i])
		}
		node.Children = children
	}

	for i := range rootNodes {
		buildTree(&rootNodes[i])
	}

	return rootNodes, nil
}

func (s *service) GetAttendanceSummary(ctx context.Context, tenantID, userID uuid.UUID) (*AttendanceSummaryResponse, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}

	// "Today" is the calendar day in the time zone of the employee's shift.
	loc, shift := EmployeeLocation(ctx, s.repo, tenantID, emp.ID, time.Now())
	punches, err := s.repo.GetTodayPunches(ctx, tenantID, emp.ID, DayStart(time.Now(), loc))
	if err != nil {
		return nil, err
	}

	lastPunch, _ := s.repo.GetLastPunch(ctx, tenantID, emp.ID)

	punchedIn := false
	var lastPunchType string
	var lastPunchTime *time.Time

	if lastPunch != nil {
		lastPunchType = lastPunch.PunchType
		lastPunchTime = &lastPunch.PunchedAt
		punchedIn = PunchState(lastPunch) == "working"
	}

	// Calculate accumulated hours today
	var totalDuration time.Duration
	var punchInTime *time.Time

	for _, p := range punches {
		if p.PunchType == "in" || p.PunchType == "break_end" {
			t := p.PunchedAt
			punchInTime = &t
		} else if (p.PunchType == "out" || p.PunchType == "break_start") && punchInTime != nil {
			totalDuration += p.PunchedAt.Sub(*punchInTime)
			punchInTime = nil
		}
	}

	if punchInTime != nil {
		totalDuration += time.Since(*punchInTime)
	}

	presence := "offline"
	if punchedIn {
		presence = "in_office_active"
	}

	shiftName := ""
	if shift != nil {
		shiftName = shift.Name
	}

	return &AttendanceSummaryResponse{
		PunchedIn:      punchedIn,
		LastPunchType:  lastPunchType,
		LastPunchTime:  lastPunchTime,
		TodayHours:     totalDuration.Hours(),
		PresenceStatus: presence,
		ShiftName:      shiftName,
	}, nil
}

func (s *service) PreviewLeave(ctx context.Context, tenantID, userID uuid.UUID, req *ApplyLeaveRequest) (*LeavePreviewResponse, error) {
	if validationErr := req.Validate(); validationErr != "" {
		return nil, errors.New(validationErr)
	}

	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}

	leaveTypeID, err := uuid.Parse(req.LeaveTypeID)
	if err != nil {
		return nil, errors.New("invalid leave_type_id")
	}

	lt, err := s.repo.GetLeaveType(ctx, tenantID, leaveTypeID)
	if err != nil || lt == nil {
		return nil, errors.New("leave type not found")
	}

	fromDate, err := time.Parse("2006-01-02", req.FromDate)
	if err != nil {
		return nil, errors.New("invalid from_date format")
	}
	toDate, err := time.Parse("2006-01-02", req.ToDate)
	if err != nil {
		return nil, errors.New("invalid to_date format")
	}
	if toDate.Before(fromDate) {
		return nil, errors.New("to_date must be on or after from_date")
	}

	holidays, _ := s.repo.ListPublicHolidays(ctx, tenantID, fromDate.Year())
	var holidayDates []time.Time
	for _, h := range holidays {
		holidayDates = append(holidayDates, h.HolidayDate)
	}

	workingDays, sandwichDays := CalculateSandwichDays(fromDate, toDate, holidayDates, lt.IsSandwichRuleEnabled)
	totalDeducted := workingDays + sandwichDays

	currentBalance := 0.0
	bal, _ := s.repo.GetLeaveBalance(ctx, tenantID, emp.ID, leaveTypeID, fromDate.Year())
	if bal != nil {
		currentBalance = bal.Balance
	}

	return &LeavePreviewResponse{
		FromDate:           req.FromDate,
		ToDate:             req.ToDate,
		WorkingDays:        workingDays,
		SandwichDaysAdded:  sandwichDays,
		TotalDeductedDays:  totalDeducted,
		CurrentBalance:     currentBalance,
		ProjectedBalance:   currentBalance - totalDeducted,
		SandwichRuleActive: lt.IsSandwichRuleEnabled,
	}, nil
}

func (s *service) ApplyLeave(ctx context.Context, tenantID, userID uuid.UUID, req *ApplyLeaveRequest) (*LeaveRequest, error) {
	preview, err := s.PreviewLeave(ctx, tenantID, userID, req)
	if err != nil {
		return nil, err
	}

	emp, _ := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	leaveTypeID, _ := uuid.Parse(req.LeaveTypeID)
	fromDate, _ := time.Parse("2006-01-02", req.FromDate)
	toDate, _ := time.Parse("2006-01-02", req.ToDate)

	if preview.TotalDeductedDays <= 0 {
		return nil, errors.New("the selected dates contain no working days")
	}
	// The same day cannot be on leave twice (it would be deducted twice).
	if overlap, err := s.repo.HasOverlappingLeave(ctx, tenantID, emp.ID, fromDate, toDate); err != nil {
		return nil, err
	} else if overlap {
		return nil, errors.New("you already have a pending or approved leave on some of these dates")
	}
	// Where a balance is tracked for this leave type, it must cover the request.
	if bal, _ := s.repo.GetLeaveBalance(ctx, tenantID, emp.ID, leaveTypeID, fromDate.Year()); bal != nil && bal.Balance < preview.TotalDeductedDays {
		return nil, fmt.Errorf("not enough leave balance: %s day(s) left, %s requested", trimNum(bal.Balance), trimNum(preview.TotalDeductedDays))
	}

	leaveReq := &LeaveRequest{
		ID:                   uuid.New(),
		TenantID:             tenantID,
		EmployeeID:           emp.ID,
		LeaveTypeID:          leaveTypeID,
		FromDate:             fromDate,
		ToDate:               toDate,
		TotalDays:            preview.TotalDeductedDays,
		SandwichDaysAdded:    preview.SandwichDaysAdded,
		Reason:               strings.TrimSpace(req.Reason),
		Status:               "pending",
		CurrentApprovalLevel: 1,
	}

	if err := s.repo.CreateLeaveRequest(ctx, leaveReq); err != nil {
		return nil, fmt.Errorf("failed to create leave request: %w", err)
	}

	typeName := "Leave"
	if lt, err := s.repo.GetLeaveType(ctx, tenantID, leaveTypeID); err == nil && lt != nil {
		typeName = lt.Name
	}
	notify.ToApproversOf(tenantID, emp.ID, notify.Message{
		Category:   notify.CategoryApproval,
		Title:      fmt.Sprintf("Leave request from %s %s", emp.FirstName, emp.LastName),
		Body:       fmt.Sprintf("%s • %s day(s), %s to %s", typeName, trimNum(leaveReq.TotalDays), fromDate.Format("2 Jan"), toDate.Format("2 Jan 2006")),
		Link:       "approvals",
		EntityType: "leave_request",
		EntityID:   &leaveReq.ID,
	})

	return leaveReq, nil
}

func (s *service) ApproveOrRejectLeave(ctx context.Context, tenantID, requestID, approverUserID uuid.UUID, status string) (*LeaveRequest, error) {
	if status != "approved" && status != "rejected" {
		return nil, errors.New("status must be 'approved' or 'rejected'")
	}

	approverEmp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, approverUserID)
	if err != nil || approverEmp == nil {
		return nil, errors.New("approver profile not found")
	}

	updatedReq, err := s.repo.UpdateLeaveRequestStatus(ctx, tenantID, requestID, status, approverEmp.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to update leave status: %w", err)
	}

	// Deduct balance on approval
	if status == "approved" {
		_ = s.repo.DeductLeaveBalance(ctx, tenantID, updatedReq.EmployeeID, updatedReq.LeaveTypeID, updatedReq.FromDate.Year(), updatedReq.TotalDays)
	}

	notify.ToEmployee(tenantID, updatedReq.EmployeeID, notify.Message{
		Category:   notify.CategoryLeave,
		Title:      "Your leave request was " + status,
		Body:       fmt.Sprintf("%s to %s • decided by %s %s", updatedReq.FromDate.Format("2 Jan"), updatedReq.ToDate.Format("2 Jan 2006"), approverEmp.FirstName, approverEmp.LastName),
		Link:       "leaves",
		EntityType: "leave_request",
		EntityID:   &updatedReq.ID,
	})

	return updatedReq, nil
}

func (s *service) ListMyLeaves(ctx context.Context, tenantID, userID uuid.UUID, limit, offset int) ([]LeaveRequest, int64, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, 0, errors.New("employee profile not found")
	}
	return s.repo.ListLeaveRequests(ctx, tenantID, &emp.ID, limit, offset)
}

func (s *service) ListAllLeaveRequests(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]LeaveRequest, int64, error) {
	return s.repo.ListLeaveRequests(ctx, tenantID, nil, limit, offset)
}

func (s *service) ListLeaveBalances(ctx context.Context, tenantID, userID uuid.UUID) ([]LeaveBalance, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}
	return s.repo.ListLeaveBalances(ctx, tenantID, emp.ID, time.Now().Year())
}

func (s *service) ListLeaveTypes(ctx context.Context, tenantID uuid.UUID) ([]LeaveType, error) {
	return s.repo.ListLeaveTypes(ctx, tenantID)
}

func normalizeTimeString(t string) string {
	t = strings.TrimSpace(t)
	if len(t) == 5 {
		return t + ":00"
	}
	return t
}

func (s *service) CreateShift(ctx context.Context, tenantID uuid.UUID, req *CreateShiftRequest) (*Shift, error) {
	if errStr := req.Validate(); errStr != "" {
		return nil, errors.New(errStr)
	}
	// The zone comes from the admin dashboard that creates the shift and is fixed from then on.
	if req.TimeZone == "" {
		return nil, errors.New("time_zone is required: it is taken from the admin dashboard creating the shift")
	}
	if !ValidZone(req.TimeZone) {
		return nil, errors.New("time_zone is not a known time zone: " + req.TimeZone)
	}

	shift := &Shift{
		ID:                  uuid.New(),
		TenantID:            tenantID,
		Name:                strings.TrimSpace(req.Name),
		StartTime:           normalizeTimeString(req.StartTime),
		EndTime:             normalizeTimeString(req.EndTime),
		TimeZone:            req.TimeZone,
		GraceMinutes:        req.GraceMinutes,
		HalfDayHours:        req.HalfDayHours,
		FullDayHours:        req.FullDayHours,
		IsNightShift:        req.IsNightShift,
		NightShiftAllowance: req.NightShiftAllowance,
	}

	if err := s.repo.CreateShift(ctx, shift); err != nil {
		return nil, fmt.Errorf("failed to create shift: %w", err)
	}
	return shift, nil
}

func (s *service) ListShifts(ctx context.Context, tenantID uuid.UUID) ([]Shift, error) {
	return s.repo.ListShifts(ctx, tenantID)
}

func (s *service) UpdateShift(ctx context.Context, tenantID, shiftID uuid.UUID, req *CreateShiftRequest) (*Shift, error) {
	if errStr := req.Validate(); errStr != "" {
		return nil, errors.New(errStr)
	}

	shift, err := s.repo.GetShiftByID(ctx, tenantID, shiftID)
	if err != nil || shift == nil {
		return nil, errors.New("shift not found")
	}

	shift.Name = strings.TrimSpace(req.Name)
	shift.StartTime = normalizeTimeString(req.StartTime)
	shift.EndTime = normalizeTimeString(req.EndTime)
	// The time zone saved at creation is permanent.
	if req.TimeZone != "" && req.TimeZone != shift.TimeZone {
		return nil, fmt.Errorf("the shift's time zone (%s) was fixed when it was created and cannot be changed. create a new shift instead", shift.TimeZone)
	}
	shift.GraceMinutes = req.GraceMinutes
	shift.HalfDayHours = req.HalfDayHours
	shift.FullDayHours = req.FullDayHours
	shift.IsNightShift = req.IsNightShift
	shift.NightShiftAllowance = req.NightShiftAllowance

	if err := s.repo.UpdateShift(ctx, shift); err != nil {
		return nil, fmt.Errorf("failed to update shift: %w", err)
	}
	return shift, nil
}

func (s *service) DeleteShift(ctx context.Context, tenantID, shiftID uuid.UUID) error {
	return s.repo.DeleteShift(ctx, tenantID, shiftID)
}

func (s *service) AssignShift(ctx context.Context, tenantID uuid.UUID, req *AssignShiftRequest) error {
	empID, err := uuid.Parse(req.EmployeeID)
	if err != nil {
		return errors.New("invalid employee_id")
	}
	shiftID, err := uuid.Parse(req.ShiftID)
	if err != nil {
		return errors.New("invalid shift_id")
	}
	effDate, err := time.Parse("2006-01-02", req.EffectiveDate)
	if err != nil {
		effDate = time.Now()
	}

	return s.repo.AssignShift(ctx, tenantID, empID, shiftID, effDate)
}

func (s *service) BulkAssignShift(ctx context.Context, tenantID uuid.UUID, req *BulkAssignShiftRequest) error {
	shiftID, err := uuid.Parse(req.ShiftID)
	if err != nil {
		return errors.New("invalid shift_id")
	}
	effDate, err := time.Parse("2006-01-02", req.EffectiveDate)
	if err != nil {
		effDate = time.Now()
	}

	for _, empIDStr := range req.EmployeeIDs {
		if empID, err := uuid.Parse(empIDStr); err == nil {
			_ = s.repo.AssignShift(ctx, tenantID, empID, shiftID, effDate)
		}
	}
	return nil
}

func (s *service) ListEmployeeRosters(ctx context.Context, tenantID uuid.UUID) ([]EmployeeShiftRosterView, error) {
	return s.repo.ListEmployeeRosters(ctx, tenantID)
}

func (s *service) GetAttendanceSession(ctx context.Context, tenantID, userID uuid.UUID) (*AttendanceSessionResponse, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}

	loc, shift := EmployeeLocation(ctx, s.repo, tenantID, emp.ID, time.Now())
	punches, err := s.repo.GetTodayPunches(ctx, tenantID, emp.ID, DayStart(time.Now(), loc))
	if err != nil {
		return nil, err
	}

	var firstPunchIn *time.Time
	var lastPunchTime *time.Time
	var lastPunchType string
	currentState := "out"

	var activeWorkSecs int64
	var breakSecs int64

	var currentWorkStart *time.Time
	var currentBreakStart *time.Time

	now := time.Now()

	for i := range punches {
		p := punches[i]
		t := p.PunchedAt

		if p.PunchType == "in" && firstPunchIn == nil {
			firstPunchIn = &t
		}

		lastPunchTime = &t
		lastPunchType = p.PunchType

		switch p.PunchType {
		case "in", "break_end":
			if currentBreakStart != nil {
				breakSecs += int64(t.Sub(*currentBreakStart).Seconds())
				currentBreakStart = nil
			}
			currentWorkStart = &t
			currentState = "working"
		case "break_start":
			if currentWorkStart != nil {
				activeWorkSecs += int64(t.Sub(*currentWorkStart).Seconds())
				currentWorkStart = nil
			}
			currentBreakStart = &t
			currentState = "on_break"
		case "out":
			if currentWorkStart != nil {
				activeWorkSecs += int64(t.Sub(*currentWorkStart).Seconds())
				currentWorkStart = nil
			}
			if currentBreakStart != nil {
				breakSecs += int64(t.Sub(*currentBreakStart).Seconds())
				currentBreakStart = nil
			}
			currentState = "out"
		}
	}

	// The live state follows the last punch (same rule as the punch check), so a night shift
	// that started before midnight still shows as checked in.
	if last, err := s.repo.GetLastPunch(ctx, tenantID, emp.ID); err == nil {
		currentState = PunchState(last)
		if currentState == "working" && currentWorkStart == nil && last != nil {
			t := last.PunchedAt
			currentWorkStart = &t
		}
	}

	if currentState == "working" && currentWorkStart != nil {
		activeWorkSecs += int64(now.Sub(*currentWorkStart).Seconds())
	} else if currentState == "on_break" && currentBreakStart != nil {
		breakSecs += int64(now.Sub(*currentBreakStart).Seconds())
	}

	// Late = first check-in after shift start + grace, both on the shift's wall clock.
	isLateIn := false
	if firstPunchIn != nil && shift != nil {
		if expectedStart, ok := ClockOn(firstPunchIn.In(loc), shift.StartTime, loc); ok {
			isLateIn = firstPunchIn.After(expectedStart.Add(time.Duration(shift.GraceMinutes) * time.Minute))
		}
	}

	return &AttendanceSessionResponse{
		EmployeeID:     emp.ID.String(),
		CurrentState:   currentState,
		Shift:          shift,
		FirstPunchIn:   firstPunchIn,
		LastPunchTime:  lastPunchTime,
		LastPunchType:  lastPunchType,
		ActiveWorkSecs: activeWorkSecs,
		BreakSecs:      breakSecs,
		IsLateIn:       isLateIn,
		TodayPunches:   punches,
	}, nil
}

func (s *service) GetMonthlyAttendance(ctx context.Context, tenantID, userID uuid.UUID, year, month int) (*MonthlyAttendanceResponse, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}

	if year <= 0 {
		year = time.Now().Year()
	}
	if month < 1 || month > 12 {
		month = int(time.Now().Month())
	}

	// Days are calendar days in the time zone of the employee's shift.
	loc, shift := EmployeeLocation(ctx, s.repo, tenantID, emp.ID, time.Date(year, time.Month(month), 1, 12, 0, 0, 0, time.UTC))
	startOfMonth := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, loc)
	endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Second)

	punches, err := s.repo.GetPunchesByDateRange(ctx, tenantID, emp.ID, startOfMonth, endOfMonth)
	if err != nil {
		return nil, err
	}

	leaves, _ := s.repo.GetApprovedLeavesByDateRange(ctx, tenantID, emp.ID, startOfMonth, endOfMonth)
	holidays, _ := s.repo.ListPublicHolidays(ctx, tenantID, year)
	regs, _ := s.repo.ListRegularizations(ctx, tenantID, &emp.ID, "")

	fullDayCutoff := 8.0
	halfDayCutoff := 4.5
	shiftName := ""
	graceMin := 0
	if shift != nil {
		fullDayCutoff = shift.FullDayHours
		halfDayCutoff = shift.HalfDayHours
		shiftName = shift.Name
		graceMin = shift.GraceMinutes
	}

	punchesByDay := make(map[string][]AttendancePunch)
	for _, p := range punches {
		dayStr := p.PunchedAt.In(loc).Format("2006-01-02")
		punchesByDay[dayStr] = append(punchesByDay[dayStr], p)
	}

	regsByDay := make(map[string]AttendanceRegularization)
	for _, r := range regs {
		dayStr := r.RequestDate.Format("2006-01-02")
		regsByDay[dayStr] = r
	}

	holidayByDay := make(map[string]string)
	for _, h := range holidays {
		dayStr := h.HolidayDate.Format("2006-01-02")
		holidayByDay[dayStr] = h.Name
	}

	daysInMonth := startOfMonth.AddDate(0, 1, -1).Day()
	days := make([]MonthlyAttendanceDay, 0, daysInMonth)

	todayStr := time.Now().In(loc).Format("2006-01-02")
	var totalPresent float64
	var totalHalfDays int
	var totalAbsent int
	var totalLeaves float64
	var totalHolidays int
	var totalWorkHours float64

	for d := 1; d <= daysInMonth; d++ {
		date := time.Date(year, time.Month(month), d, 0, 0, 0, 0, loc)
		dateStr := date.Format("2006-01-02")
		dayOfWeek := date.Weekday().String()

		dayItem := MonthlyAttendanceDay{
			Date:          dateStr,
			DayOfWeek:     dayOfWeek,
			ExpectedHours: fullDayCutoff,
			ShiftName:     shiftName,
			Punches:       punchesByDay[dateStr],
		}

		// 1. Weekend Check (Strict Zero Sandwich Policy: Sat/Sun are off days)
		if date.Weekday() == time.Saturday || date.Weekday() == time.Sunday {
			dayItem.Status = "weekend"
			dayItem.StatusLabel = "Weekend Off"
			dayItem.ExpectedHours = 0
			dayItem.CanRegularize = false
		}

		// 2. Public Holiday Check
		if holName, exists := holidayByDay[dateStr]; exists {
			dayItem.Status = "holiday"
			dayItem.StatusLabel = holName
			dayItem.ExpectedHours = 0
			dayItem.CanRegularize = false
			totalHolidays++
		}

		// 3. Approved Leave Check (Only strictly applied dates)
		for _, l := range leaves {
			// Leave dates are plain calendar dates: compare them as dates.
			if dateStr >= l.FromDate.Format("2006-01-02") && dateStr <= l.ToDate.Format("2006-01-02") {
				if date.Weekday() != time.Saturday && date.Weekday() != time.Sunday {
					typeName := "Leave"
					if l.LeaveTypeName != nil {
						typeName = *l.LeaveTypeName
					}
					dayItem.Status = "leave"
					dayItem.StatusLabel = typeName
					dayItem.LeaveDetails = &l.Reason
					dayItem.ExpectedHours = 0
					dayItem.CanRegularize = false
					totalLeaves++
					break
				}
			}
		}

		// 4. Evaluate Punches if recorded on this day
		dayPunches := punchesByDay[dateStr]
		var workSecs int64
		var breakSecs int64
		var firstIn *time.Time
		var lastOut *time.Time
		var workStart *time.Time
		var breakStart *time.Time

		for _, p := range dayPunches {
			t := p.PunchedAt
			if p.PunchType == "in" && firstIn == nil {
				firstIn = &t
			}
			if p.PunchType == "out" {
				lastOut = &t
			}
			switch p.PunchType {
			case "in", "break_end":
				if breakStart != nil {
					breakSecs += int64(t.Sub(*breakStart).Seconds())
					breakStart = nil
				}
				workStart = &t
			case "break_start":
				if workStart != nil {
					workSecs += int64(t.Sub(*workStart).Seconds())
					workStart = nil
				}
				breakStart = &t
			case "out":
				if workStart != nil {
					workSecs += int64(t.Sub(*workStart).Seconds())
					workStart = nil
				}
				if breakStart != nil {
					breakSecs += int64(t.Sub(*breakStart).Seconds())
					breakStart = nil
				}
			}
		}

		if dateStr == todayStr && workStart != nil {
			workSecs += int64(time.Now().Sub(*workStart).Seconds())
		}

		workHrs := float64(workSecs) / 3600.0
		brkHrs := float64(breakSecs) / 3600.0
		dayItem.WorkHours = workHrs
		dayItem.BreakHours = brkHrs
		dayItem.FirstPunchIn = firstIn
		dayItem.LastPunchOut = lastOut

		if firstIn != nil && shift != nil {
			if expectedStart, ok := ClockOn(firstIn.In(loc), shift.StartTime, loc); ok {
				dayItem.IsLateIn = firstIn.After(expectedStart.Add(time.Duration(graceMin) * time.Minute))
			}
		}

		if len(dayPunches) > 0 {
			if workHrs >= fullDayCutoff*0.85 {
				dayItem.Status = "present"
				dayItem.StatusLabel = "Present"
				totalPresent++
			} else if workHrs >= halfDayCutoff*0.85 {
				dayItem.Status = "half_day"
				dayItem.StatusLabel = "Half Day"
				totalHalfDays++
				totalPresent += 0.5
			} else {
				dayItem.Status = "half_day"
				dayItem.StatusLabel = "Partial"
				totalHalfDays++
			}
			totalWorkHours += workHrs
		} else if dayItem.Status == "" {
			if dateStr < todayStr {
				dayItem.Status = "absent"
				dayItem.StatusLabel = "Absent"
				dayItem.CanRegularize = true
				totalAbsent++
			} else if dateStr == todayStr {
				dayItem.Status = "pending"
				dayItem.StatusLabel = "Not Punched"
				dayItem.CanRegularize = false
			} else {
				dayItem.Status = "scheduled"
				dayItem.StatusLabel = "Scheduled"
				dayItem.CanRegularize = false
			}
		}

		// 5. Regularization Override Check
		if reg, exists := regsByDay[dateStr]; exists {
			regIDStr := reg.ID.String()
			dayItem.RegularizationID = &regIDStr
			if reg.Status == "approved" {
				dayItem.Status = "regularized"
				dayItem.StatusLabel = fmt.Sprintf("Regularized (%s)", reg.RequestType)
				dayItem.CanRegularize = false
			} else if reg.Status == "pending" {
				dayItem.StatusLabel += " (Pending Review)"
				dayItem.CanRegularize = false
			}
		}

		days = append(days, dayItem)
	}

	avgHours := 0.0
	if totalPresent > 0 {
		avgHours = totalWorkHours / totalPresent
	}

	return &MonthlyAttendanceResponse{
		Year:             year,
		Month:            month,
		Days:             days,
		TotalPresent:     totalPresent,
		TotalHalfDays:    totalHalfDays,
		TotalAbsent:      totalAbsent,
		TotalLeaves:      totalLeaves,
		TotalHolidays:    totalHolidays,
		TotalWorkHours:   totalWorkHours,
		AverageWorkHours: avgHours,
	}, nil
}

func (s *service) GetTeamPresenceRadar(ctx context.Context, tenantID uuid.UUID) ([]TeamPresenceRadarMember, error) {
	employees, _, err := s.repo.ListEmployees(ctx, tenantID, "", "", 200, 0)
	if err != nil {
		return nil, err
	}

	// Everyone's "today" starts at midnight in their own shift's time zone, and no zone is
	// more than 14 hours ahead of UTC, so the last 38 hours cover every possible today.
	today := time.Now()
	recentPunches, err := s.repo.GetTeamPunchesSince(ctx, tenantID, today.Add(-38*time.Hour))
	if err != nil {
		return nil, err
	}

	punchesByEmp := make(map[uuid.UUID][]AttendancePunch)
	for _, p := range recentPunches {
		punchesByEmp[p.EmployeeID] = append(punchesByEmp[p.EmployeeID], p)
	}

	var members []TeamPresenceRadarMember
	for _, emp := range employees {
		loc, shift := EmployeeLocation(ctx, s.repo, tenantID, emp.ID, today)
		shiftName := ""
		if shift != nil {
			shiftName = shift.Name
		}
		dayStart := DayStart(today, loc)
		localToday := today.In(loc)
		// Leave dates are calendar dates, stored as UTC midnight.
		todayStart := time.Date(localToday.Year(), localToday.Month(), localToday.Day(), 0, 0, 0, 0, time.UTC)
		todayEnd := todayStart.Add(24*time.Hour - time.Second)

		var empPunches []AttendancePunch
		for _, p := range punchesByEmp[emp.ID] {
			if !p.PunchedAt.Before(dayStart) {
				empPunches = append(empPunches, p)
			}
		}
		presence := "absent"
		var firstIn *time.Time
		var lastTime *time.Time
		var activeSecs int64
		var workStart *time.Time

		for _, p := range empPunches {
			t := p.PunchedAt
			if p.PunchType == "in" && firstIn == nil {
				firstIn = &t
			}
			lastTime = &t
			switch p.PunchType {
			case "in", "break_end":
				workStart = &t
				presence = "working"
			case "break_start":
				if workStart != nil {
					activeSecs += int64(t.Sub(*workStart).Seconds())
					workStart = nil
				}
				presence = "on_break"
			case "out":
				if workStart != nil {
					activeSecs += int64(t.Sub(*workStart).Seconds())
					workStart = nil
				}
				presence = "out"
			}
		}

		if presence == "working" && workStart != nil {
			activeSecs += int64(time.Since(*workStart).Seconds())
		}

		leaves, _ := s.repo.GetApprovedLeavesByDateRange(ctx, tenantID, emp.ID, todayStart, todayEnd)
		if len(leaves) > 0 {
			presence = "on_leave"
		}

		if len(empPunches) == 0 && presence != "on_leave" {
			presence = "not_punched"
		}

		members = append(members, TeamPresenceRadarMember{
			EmployeeID:     emp.ID.String(),
			EmployeeCode:   emp.EmployeeCode,
			FirstName:      emp.FirstName,
			LastName:       emp.LastName,
			WorkEmail:      emp.WorkEmail,
			DepartmentName: emp.DepartmentName,
			AvatarURL:      emp.AvatarURL,
			PresenceStatus: presence,
			FirstPunchIn:   firstIn,
			LastPunchTime:  lastTime,
			ActiveWorkSecs: activeSecs,
			ShiftName:      shiftName,
		})
	}

	return members, nil
}

func (s *service) CreateRegularization(ctx context.Context, tenantID, userID uuid.UUID, req *CreateRegularizationRequest) (*AttendanceRegularization, error) {
	if errStr := req.Validate(); errStr != "" {
		return nil, errors.New(errStr)
	}

	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}

	reqDate, err := time.Parse("2006-01-02", req.RequestDate)
	if err != nil {
		return nil, errors.New("invalid request_date format (YYYY-MM-DD)")
	}
	// A missed punch can only be for a day that has started (on the shift's calendar).
	empLoc, _ := EmployeeLocation(ctx, s.repo, tenantID, emp.ID, time.Now())
	if req.RequestType == "missed_punch" && req.RequestDate > time.Now().In(empLoc).Format("2006-01-02") {
		return nil, errors.New("a missed punch cannot be requested for a future date")
	}
	// One open or approved correction per day: approving several would add several punches.
	if regs, err := s.repo.ListRegularizations(ctx, tenantID, &emp.ID, ""); err == nil {
		for _, r := range regs {
			if r.RequestDate.Format("2006-01-02") == req.RequestDate && (r.Status == "pending" || r.Status == "approved") {
				return nil, errors.New("there is already a pending or approved correction for this date")
			}
		}
	}

	var punchIn *time.Time
	var punchOut *time.Time

	// A bare "HH:MM" is a time on the shift's wall clock on the requested date.
	loc, _ := EmployeeLocation(ctx, s.repo, tenantID, emp.ID, reqDate)
	parseRequested := func(v *string) *time.Time {
		if v == nil || *v == "" {
			return nil
		}
		if t, err := time.Parse(time.RFC3339, *v); err == nil {
			return &t
		}
		if t, ok := ClockOn(reqDate, *v, loc); ok {
			return &t
		}
		return nil
	}
	punchIn = parseRequested(req.RequestedPunchIn)
	punchOut = parseRequested(req.RequestedPunchOut)
	if punchIn != nil && punchOut != nil && !punchOut.After(*punchIn) {
		next := punchOut.AddDate(0, 0, 1) // ends after midnight (night shift)
		punchOut = &next
	}

	reg := &AttendanceRegularization{
		ID:                uuid.New(),
		TenantID:          tenantID,
		EmployeeID:        emp.ID,
		RequestType:       req.RequestType,
		RequestDate:       reqDate,
		RequestedPunchIn:  punchIn,
		RequestedPunchOut: punchOut,
		Reason:            req.Reason,
		Status:            "pending",
	}

	if err := s.repo.CreateRegularization(ctx, reg); err != nil {
		return nil, fmt.Errorf("failed to submit regularization request: %w", err)
	}

	notify.ToApproversOf(tenantID, emp.ID, notify.Message{
		Category:   notify.CategoryApproval,
		Title:      fmt.Sprintf("Attendance correction from %s %s", emp.FirstName, emp.LastName),
		Body:       "For " + reqDate.Format("Mon, 2 Jan 2006"),
		Link:       "approvals",
		EntityType: "regularization",
		EntityID:   &reg.ID,
	})

	return reg, nil
}

func (s *service) ListMyRegularizations(ctx context.Context, tenantID, userID uuid.UUID, status string) ([]AttendanceRegularization, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}
	return s.repo.ListRegularizations(ctx, tenantID, &emp.ID, status)
}

func (s *service) ListTeamRegularizations(ctx context.Context, tenantID uuid.UUID, status string) ([]AttendanceRegularization, error) {
	return s.repo.ListRegularizations(ctx, tenantID, nil, status)
}

func (s *service) ReviewRegularization(ctx context.Context, tenantID, regID, reviewerUserID uuid.UUID, req *ReviewRegularizationRequest) (*AttendanceRegularization, error) {
	if req.Status != "approved" && req.Status != "rejected" {
		return nil, errors.New("status must be 'approved' or 'rejected'")
	}

	reviewer, _ := s.repo.GetEmployeeByUserID(ctx, tenantID, reviewerUserID)
	var reviewerID uuid.UUID
	if reviewer != nil {
		reviewerID = reviewer.ID
	}

	reg, err := s.repo.UpdateRegularizationStatus(ctx, tenantID, regID, reviewerID, req.Status)
	if err != nil {
		return nil, fmt.Errorf("failed to update regularization: %w", err)
	}

	if req.Status == "approved" {
		inTime := reg.RequestedPunchIn
		outTime := reg.RequestedPunchOut

		if inTime == nil || outTime == nil {
			// Missing times default to the shift's start and end on that date, in the shift's zone.
			shift, _ := s.repo.GetEmployeeShift(ctx, tenantID, reg.EmployeeID, reg.RequestDate)
			if shift != nil {
				loc := shift.Location()
				synthIn, okIn := ClockOn(reg.RequestDate, shift.StartTime, loc)
				synthOut, okOut := ClockOn(reg.RequestDate, shift.EndTime, loc)
				if okIn && okOut {
					if !synthOut.After(synthIn) {
						synthOut = synthOut.AddDate(0, 0, 1) // night shift ends the next morning
					}
					if inTime == nil {
						inTime = &synthIn
					}
					if outTime == nil {
						outTime = &synthOut
					}
				}
			}
		}

		if inTime != nil {
			punchIn := &AttendancePunch{
				ID:                 uuid.New(),
				TenantID:           tenantID,
				EmployeeID:         reg.EmployeeID,
				PunchType:          "in",
				PunchedAt:          *inTime,
				IsGeofenceVerified: true,
				Source:             "regularization",
			}
			_ = s.repo.CreateAttendancePunch(ctx, punchIn)
		}

		if outTime != nil {
			punchOut := &AttendancePunch{
				ID:                 uuid.New(),
				TenantID:           tenantID,
				EmployeeID:         reg.EmployeeID,
				PunchType:          "out",
				PunchedAt:          *outTime,
				IsGeofenceVerified: true,
				Source:             "regularization",
			}
			_ = s.repo.CreateAttendancePunch(ctx, punchOut)
		}
	}

	notify.ToEmployee(tenantID, reg.EmployeeID, notify.Message{
		Category:   notify.CategoryAttendance,
		Title:      "Your attendance correction was " + req.Status,
		Body:       "For " + reg.RequestDate.Format("Mon, 2 Jan 2006"),
		Link:       "attendance",
		EntityType: "regularization",
		EntityID:   &reg.ID,
	})

	return reg, nil
}

func (s *service) UpdateEmployeeBiometricFace(ctx context.Context, tenantID, employeeID uuid.UUID, req *EnrollBiometricFaceRequest) (*EnrollBiometricFaceResponse, error) {
	if validationErr := req.Validate(); validationErr != "" {
		return nil, errors.New(validationErr)
	}

	emp, err := s.repo.GetEmployeeByID(ctx, tenantID, employeeID)
	if err != nil || emp == nil {
		return nil, errors.New("employee record not found")
	}

	var extractedVectors [][]float32
	var primaryMasterImg image.Image

	for i, rawImgStr := range req.Images {
		img, _, err := biometrics.DecodeImage([]byte(rawImgStr))
		if err != nil {
			return nil, fmt.Errorf("failed to decode enrollment image #%d: %w", i+1, err)
		}

		rawPath := saveBiometricDebugImage(fmt.Sprintf("enroll_sample%d_raw", i+1), employeeID.String(), img)

		if i == 0 {
			primaryMasterImg = img
		}

		tensor, resized112, quality, err := biometrics.PreprocessForMobileFaceNetWithImage(img)
		var cropPath string
		if resized112 != nil {
			cropPath = saveBiometricDebugImage(fmt.Sprintf("enroll_sample%d_112x112", i+1), employeeID.String(), resized112)
		}

		if err != nil {
			log.Printf("[BIOMETRIC DEBUG] Enrollment Sample #%d REJECTED: Employee=%s, RawFile=%s (%dx%d), Reason=%s, Blur=%.2f, Brightness=%.2f",
				i+1, employeeID, rawPath, img.Bounds().Dx(), img.Bounds().Dy(), quality.RejectionReason, quality.BlurScore, quality.BrightnessScore)
			return nil, fmt.Errorf("image #%d rejected by quality check: %s", i+1, quality.RejectionReason)
		}

		log.Printf("[BIOMETRIC DEBUG] Enrollment Sample #%d ACCEPTED: Employee=%s, RawFile=%s (%dx%d), Crop112=%s, Blur=%.2f, Brightness=%.2f",
			i+1, employeeID, rawPath, img.Bounds().Dx(), img.Bounds().Dy(), cropPath, quality.BlurScore, quality.BrightnessScore)

		vec, err := s.embedder.ExtractEmbeddings(tensor)
		if err != nil {
			return nil, fmt.Errorf("failed to extract embedding from image #%d: %w", i+1, err)
		}

		extractedVectors = append(extractedVectors, vec)
	}

	// Compute unit-normalized centroid vector across all enrolled photos
	centroid, err := biometrics.ComputeCentroidEmbedding(extractedVectors)
	if err != nil {
		return nil, fmt.Errorf("failed to compute centroid embedding: %w", err)
	}

	embeddingBytes, err := json.Marshal(centroid)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize face embedding: %w", err)
	}

	// Upload primary master image to MinIO or fallback
	faceURL := ""
	storage := media.GetDefaultStorage()
	if storage != nil && primaryMasterImg != nil {
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, primaryMasterImg, &jpeg.Options{Quality: 92}); err == nil {
			objectName := fmt.Sprintf("biometrics/%s/master_%d.jpg", employeeID.String(), time.Now().Unix())
			uploadedPath, err := storage.UploadFile(ctx, "paylogic-media", objectName, bytes.NewReader(buf.Bytes()), int64(buf.Len()), "image/jpeg")
			if err == nil {
				faceURL = storage.FormatURL(uploadedPath)
			}
		}
	}
	if faceURL == "" && len(req.Images) > 0 {
		faceURL = req.Images[0]
	}

	if err := s.repo.UpdateEmployeeBiometricFace(ctx, tenantID, employeeID, faceURL, string(embeddingBytes), len(extractedVectors)); err != nil {
		return nil, fmt.Errorf("failed to save employee biometric face: %w", err)
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	return &EnrollBiometricFaceResponse{
		EmployeeID:  employeeID.String(),
		FaceURL:     faceURL,
		SampleCount: len(extractedVectors),
		EnrolledAt:  nowStr,
		Message:     fmt.Sprintf("Successfully registered biometric face profile using %d photo sample(s).", len(extractedVectors)),
	}, nil
}

// faceMatch is the outcome of comparing a selfie with the employee's enrolled face.
type faceMatch struct {
	image      image.Image
	confidence float64
	distance   float32
	matched    bool
}

// verifyEmployeeFace runs the full selfie pipeline (decode, quality, liveness,
// embedding) and compares it with the enrolled template. A mismatch is reported
// through matched=false so callers can still archive the selfie for audit.
func (s *service) verifyEmployeeFace(emp *Employee, selfieData string) (*faceMatch, error) {
	if emp.FaceEmbedding == nil || *emp.FaceEmbedding == "" {
		return nil, errors.New("no biometric face profile registered for this employee. Please contact Management / HR to enroll your face")
	}

	var storedEmbedding []float32
	if err := json.Unmarshal([]byte(*emp.FaceEmbedding), &storedEmbedding); err != nil || len(storedEmbedding) == 0 {
		return nil, errors.New("corrupted biometric profile in database. Please ask HR to re-enroll your face")
	}

	// Decode selfie image
	selfieImg, _, err := biometrics.DecodeImage([]byte(selfieData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode check-in selfie: %w", err)
	}

	rawPath := saveBiometricDebugImage("punch_raw", emp.ID.String(), selfieImg)
	dims := fmt.Sprintf("%dx%d", selfieImg.Bounds().Dx(), selfieImg.Bounds().Dy())

	tensor, resized112, quality, err := biometrics.PreprocessForMobileFaceNetWithImage(selfieImg)
	var cropPath string
	if resized112 != nil {
		cropPath = saveBiometricDebugImage("punch_112x112", emp.ID.String(), resized112)
	}

	if err != nil {
		log.Printf("[BIOMETRIC DEBUG] Punch REJECTED during Preprocessing: Employee=%s (%s), RawFile=%s (%s), Crop112=%s, Reason=%s, Blur=%.2f, Brightness=%.2f, Liveness=%.2f",
			emp.ID, emp.WorkEmail, rawPath, dims, cropPath, err.Error(), quality.BlurScore, quality.BrightnessScore, quality.LivenessScore)
		if quality.RejectionReason != "" {
			return nil, errors.New(quality.RejectionReason)
		}
		return nil, fmt.Errorf("selfie processing failed: %w", err)
	}

	selfieVec, err := s.embedder.ExtractEmbeddings(tensor)
	if err != nil {
		return nil, fmt.Errorf("failed to process face features: %w", err)
	}

	isMatched, distance, confidence, err := biometrics.VerifyIdentity(selfieVec, storedEmbedding, biometrics.OptimalL2Threshold)
	if err != nil {
		return nil, fmt.Errorf("failed to verify face identity: %w", err)
	}

	log.Printf("[BIOMETRIC DEBUG] Punch ATTEMPT: Employee=%s (%s), Matched=%v, Score=%.1f%%, Distance=%.4f (Threshold=%.2f), RawFile=%s (%s), Crop112=%s",
		emp.ID, emp.WorkEmail, isMatched, confidence, distance, biometrics.OptimalL2Threshold, rawPath, dims, cropPath)

	return &faceMatch{image: selfieImg, confidence: confidence, distance: distance, matched: isMatched}, nil
}

// checkPunchGeofence requires the punch to be inside an office perimeter when the
// organisation has configured offices.
func (s *service) checkPunchGeofence(ctx context.Context, tenantID uuid.UUID, lat, lng *float64) (bool, error) {
	isGeofenceVerified := false
	offices, _ := s.repo.ListOfficeLocations(ctx, tenantID)
	if len(offices) > 0 {
		if lat == nil || lng == nil {
			return false, errors.New("location check failed: GPS coordinates are required for attendance check-in/check-out")
		}

		var nearestOffice *OfficeLocation
		minDist := math.MaxFloat64

		for i := range offices {
			off := &offices[i]
			dist := HaversineDistance(off.Latitude, off.Longitude, *lat, *lng)
			if dist < minDist {
				minDist = dist
				nearestOffice = off
			}
			verified, _ := VerifyGeofence(off, *lat, *lng, "")
			if verified {
				isGeofenceVerified = true
				break
			}
		}

		if !isGeofenceVerified {
			if nearestOffice != nil {
				return false, fmt.Errorf("geofence check failed: you are %.1fm away from '%s' (allowed radius: %dm). Punch rejected", minDist, nearestOffice.Name, nearestOffice.RadiusMeters)
			}
			return false, errors.New("geofence check failed: outside designated office perimeter. Punch rejected")
		}
	}

	return isGeofenceVerified, nil
}

func (s *service) PunchWithFace(ctx context.Context, tenantID, userID uuid.UUID, req *PunchWithFaceRequest) (*PunchWithFaceResponse, error) {
	if validationErr := req.Validate(); validationErr != "" {
		return nil, errors.New(validationErr)
	}

	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}
	// The shift's saved time zone decides the attendance day, so a shift is required.
	if _, err := ShiftForPunch(ctx, s.repo, tenantID, emp.ID, req.PunchType); err != nil {
		return nil, err
	}

	match, err := s.verifyEmployeeFace(emp, req.SelfieImage)
	if err != nil {
		return nil, err
	}
	selfieImg, confidence, distance, isMatched := match.image, match.confidence, match.distance, match.matched

	// Upload selfie to MinIO audit bucket
	var selfieURL string
	storage := media.GetDefaultStorage()
	if storage != nil {
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, selfieImg, &jpeg.Options{Quality: 85}); err == nil {
			today := time.Now().UTC().Format("2006-01-02")
			objectName := fmt.Sprintf("selfies/%s/%s/%s_%d.jpg", emp.ID.String(), today, req.PunchType, time.Now().Unix())
			uploadedPath, err := storage.UploadFile(ctx, "paylogic-media", objectName, bytes.NewReader(buf.Bytes()), int64(buf.Len()), "image/jpeg")
			if err == nil {
				selfieURL = storage.FormatURL(uploadedPath)
			}
		}
	}
	// Keep database rows compact: only store valid object storage URL, never raw Base64 blobs
	var selfieURLPtr *string
	if selfieURL != "" && !strings.HasPrefix(selfieURL, "data:image") {
		selfieURLPtr = &selfieURL
	}

	distFloat := float64(distance)
	if !isMatched {
		return nil, fmt.Errorf("identity mismatch: face belongs to a different person (match score: %.1f%%, required: >= 75.0%%). Proxy punch prevented", confidence)
	}

	// Face is verified! Verify location & record attendance punch
	punchedAt := time.Now().UTC()
	isGeofenceVerified, err := s.checkPunchGeofence(ctx, tenantID, req.Latitude, req.Longitude)
	if err != nil {
		return nil, err
	}

	punch := &AttendancePunch{
		ID:                 uuid.New(),
		TenantID:           tenantID,
		EmployeeID:         emp.ID,
		PunchType:          req.PunchType,
		PunchedAt:          punchedAt,
		Latitude:           req.Latitude,
		Longitude:          req.Longitude,
		AccuracyMeters:     req.AccuracyMeters,
		IsGeofenceVerified: isGeofenceVerified,
		Source:             req.Source,
		IsFaceVerified:     true,
		FaceConfidence:     &confidence,
		FaceDistance:       &distFloat,
		SelfieURL:          selfieURLPtr,
	}

	if req.LocationID != nil && *req.LocationID != "" {
		if locID, err := uuid.Parse(*req.LocationID); err == nil {
			punch.LocationID = &locID
		}
	}

	if err := s.repo.CreateAttendancePunch(ctx, punch); err != nil {
		return nil, fmt.Errorf("failed to record attendance punch: %w", err)
	}

	return &PunchWithFaceResponse{
		ID:                 punch.ID.String(),
		PunchType:          punch.PunchType,
		PunchedAt:          punch.PunchedAt,
		IsFaceVerified:     true,
		FaceConfidence:     confidence,
		FaceDistance:       distance,
		SelfieURL:          selfieURL,
		IsGeofenceVerified: punch.IsGeofenceVerified,
		Message:            fmt.Sprintf("Face verified successfully (%.1f%% match)! Check-%s recorded.", confidence, req.PunchType),
	}, nil
}

func (s *service) ListOfficeLocations(ctx context.Context, tenantID uuid.UUID) ([]OfficeLocation, error) {
	return s.repo.ListOfficeLocations(ctx, tenantID)
}

func (s *service) GetOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID) (*OfficeLocation, error) {
	return s.repo.GetOfficeLocation(ctx, tenantID, locationID)
}

func (s *service) CreateOfficeLocation(ctx context.Context, tenantID uuid.UUID, req *CreateOfficeLocationRequest) (*OfficeLocation, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("office name is required")
	}
	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		return nil, errors.New("valid latitude [-90, 90] and longitude [-180, 180] are required")
	}
	radius := req.RadiusMeters
	if radius <= 0 {
		radius = 100
	}

	loc := &OfficeLocation{
		ID:                 uuid.New(),
		TenantID:           tenantID,
		Name:               strings.TrimSpace(req.Name),
		Latitude:           req.Latitude,
		Longitude:          req.Longitude,
		RadiusMeters:       radius,
		PolygonCoordinates: req.PolygonCoordinates,
		AllowedIPRanges:    req.AllowedIPRanges,
		AllowedWiFiBSSID:   req.AllowedWiFiBSSID,
		CreatedAt:          time.Now().UTC(),
	}

	if err := s.repo.CreateOfficeLocation(ctx, loc); err != nil {
		return nil, fmt.Errorf("failed to create office location: %w", err)
	}
	return loc, nil
}

func (s *service) UpdateOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID, req *UpdateOfficeLocationRequest) (*OfficeLocation, error) {
	loc, err := s.repo.GetOfficeLocation(ctx, tenantID, locationID)
	if err != nil || loc == nil {
		return nil, errors.New("office location not found")
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		loc.Name = strings.TrimSpace(*req.Name)
	}
	if req.Latitude != nil {
		loc.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		loc.Longitude = *req.Longitude
	}
	if req.RadiusMeters != nil && *req.RadiusMeters > 0 {
		loc.RadiusMeters = *req.RadiusMeters
	}
	if req.PolygonCoordinates != nil {
		loc.PolygonCoordinates = req.PolygonCoordinates
	}
	if req.AllowedIPRanges != nil {
		loc.AllowedIPRanges = req.AllowedIPRanges
	}
	if req.AllowedWiFiBSSID != nil {
		loc.AllowedWiFiBSSID = req.AllowedWiFiBSSID
	}

	if err := s.repo.UpdateOfficeLocation(ctx, loc); err != nil {
		return nil, fmt.Errorf("failed to update office location: %w", err)
	}
	return loc, nil
}

func (s *service) DeleteOfficeLocation(ctx context.Context, tenantID, locationID uuid.UUID) error {
	return s.repo.DeleteOfficeLocation(ctx, tenantID, locationID)
}

func (s *service) ListDepartments(ctx context.Context, tenantID uuid.UUID) ([]Department, error) {
	return s.repo.ListDepartments(ctx, tenantID)
}

func (s *service) CreateDepartment(ctx context.Context, tenantID uuid.UUID, name string) (*Department, error) {
	dept := &Department{
		ID:       uuid.New(),
		TenantID: tenantID,
		Name:     strings.TrimSpace(name),
	}
	if err := s.repo.CreateDepartment(ctx, dept); err != nil {
		return nil, fmt.Errorf("failed to create department: %w", err)
	}
	return dept, nil
}

func (s *service) ListDesignations(ctx context.Context, tenantID uuid.UUID) ([]Designation, error) {
	return s.repo.ListDesignations(ctx, tenantID)
}

func (s *service) CreateDesignation(ctx context.Context, tenantID uuid.UUID, title string) (*Designation, error) {
	desig := &Designation{
		ID:       uuid.New(),
		TenantID: tenantID,
		Title:    strings.TrimSpace(title),
	}
	if err := s.repo.CreateDesignation(ctx, desig); err != nil {
		return nil, fmt.Errorf("failed to create designation: %w", err)
	}
	return desig, nil
}



// trimNum formats a day count without a needless ".0" (1.5 stays 1.5, 2.0 becomes 2).
func trimNum(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}
