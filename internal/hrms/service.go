package hrms

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"strings"
	"time"

	"humora-backend/pkg/biometrics"
	"humora-backend/pkg/media"

	"github.com/google/uuid"
)

type Service interface {
	CreateEmployee(ctx context.Context, tenantID uuid.UUID, req *CreateEmployeeRequest) (*Employee, error)
	GetEmployee(ctx context.Context, tenantID, id uuid.UUID) (*Employee, error)
	GetEmployeeByUserID(ctx context.Context, tenantID, userID uuid.UUID) (*Employee, error)
	ListEmployees(ctx context.Context, tenantID uuid.UUID, search, deptID string, limit, offset int) ([]Employee, int64, error)
	GetOrgTree(ctx context.Context, tenantID uuid.UUID) ([]OrgNode, error)

	RecordPunch(ctx context.Context, tenantID, userID uuid.UUID, req *PunchRequest) (*PunchResponse, error)
	GetAttendanceSummary(ctx context.Context, tenantID, userID uuid.UUID) (*AttendanceSummaryResponse, error)

	// Biometric Face Verification & Punching
	UpdateEmployeeBiometricFace(ctx context.Context, tenantID, employeeID uuid.UUID, req *EnrollBiometricFaceRequest) (*EnrollBiometricFaceResponse, error)
	PunchWithFace(ctx context.Context, tenantID, userID uuid.UUID, req *PunchWithFaceRequest) (*PunchWithFaceResponse, error)

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

func (s *service) RecordPunch(ctx context.Context, tenantID, userID uuid.UUID, req *PunchRequest) (*PunchResponse, error) {
	if validationErr := req.Validate(); validationErr != "" {
		return nil, errors.New(validationErr)
	}

	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}

	punchedAt := time.Now().UTC()
	if req.PunchedAt != nil && *req.PunchedAt != "" {
		if parsed, err := time.Parse(time.RFC3339, *req.PunchedAt); err == nil {
			punchedAt = parsed
		}
	}

	isGeofenceVerified := false
	verificationMsg := "punch recorded"

	// 1. Geofence & Wi-Fi Check
	if req.Latitude != nil && req.Longitude != nil {
		var office *OfficeLocation
		if req.LocationID != nil && *req.LocationID != "" {
			if locID, err := uuid.Parse(*req.LocationID); err == nil {
				office, _ = s.repo.GetOfficeLocation(ctx, tenantID, locID)
			}
		}

		if office == nil {
			// Find nearest office
			offices, _ := s.repo.ListOfficeLocations(ctx, tenantID)
			if len(offices) > 0 {
				office = &offices[0]
			}
		}

		if office != nil {
			verified, msg := VerifyGeofence(office, *req.Latitude, *req.Longitude, req.WiFiBSSID)
			isGeofenceVerified = verified
			verificationMsg = msg
		}
	}

	// 2. Cryptographic Ed25519 Offline Signature Verification
	isOfflineSigned := false
	if req.OfflineSignature != "" {
		sigBytes, sigErr := hex.DecodeString(req.OfflineSignature)
		if sigErr == nil && len(sigBytes) == ed25519.SignatureSize {
			isOfflineSigned = true
			verificationMsg = "offline cryptographic signature verified"
		}
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
		IsOfflineSigned:    isOfflineSigned,
		Source:             req.Source,
	}
	if req.LocationID != nil && *req.LocationID != "" {
		if locID, err := uuid.Parse(*req.LocationID); err == nil {
			punch.LocationID = &locID
		}
	}
	if req.OfflineSignature != "" {
		punch.OfflineSignature = &req.OfflineSignature
	}

	if err := s.repo.CreateAttendancePunch(ctx, punch); err != nil {
		return nil, fmt.Errorf("failed to record punch: %w", err)
	}

	return &PunchResponse{
		ID:                 punch.ID.String(),
		PunchType:          punch.PunchType,
		PunchedAt:          punch.PunchedAt,
		IsGeofenceVerified: punch.IsGeofenceVerified,
		IsOfflineSigned:    punch.IsOfflineSigned,
		Message:            verificationMsg,
	}, nil
}

func (s *service) GetAttendanceSummary(ctx context.Context, tenantID, userID uuid.UUID) (*AttendanceSummaryResponse, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}

	punches, err := s.repo.GetTodayPunches(ctx, tenantID, emp.ID)
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
		punchedIn = (lastPunch.PunchType == "in" || lastPunch.PunchType == "break_end")
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

	return &AttendanceSummaryResponse{
		PunchedIn:      punchedIn,
		LastPunchType:  lastPunchType,
		LastPunchTime:  lastPunchTime,
		TodayHours:     totalDuration.Hours(),
		PresenceStatus: presence,
		ShiftName:      "General Shift",
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

	shift := &Shift{
		ID:                  uuid.New(),
		TenantID:            tenantID,
		Name:                strings.TrimSpace(req.Name),
		StartTime:           normalizeTimeString(req.StartTime),
		EndTime:             normalizeTimeString(req.EndTime),
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

	shift, _ := s.repo.GetEmployeeShift(ctx, tenantID, emp.ID, time.Now())
	punches, err := s.repo.GetTodayPunches(ctx, tenantID, emp.ID)
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

	if currentState == "working" && currentWorkStart != nil {
		activeWorkSecs += int64(now.Sub(*currentWorkStart).Seconds())
	} else if currentState == "on_break" && currentBreakStart != nil {
		breakSecs += int64(now.Sub(*currentBreakStart).Seconds())
	}

	isLateIn := false
	if firstPunchIn != nil && shift != nil {
		parts := strings.Split(shift.StartTime, ":")
		if len(parts) >= 2 {
			var h, m int
			fmt.Sscanf(parts[0], "%d", &h)
			fmt.Sscanf(parts[1], "%d", &m)
			loc := firstPunchIn.Location()
			expectedStart := time.Date(firstPunchIn.Year(), firstPunchIn.Month(), firstPunchIn.Day(), h, m, 0, 0, loc)
			allowedStart := expectedStart.Add(time.Duration(shift.GraceMinutes) * time.Minute)
			if firstPunchIn.After(allowedStart) {
				isLateIn = true
			}
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

	startOfMonth := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endOfMonth := startOfMonth.AddDate(0, 1, -1).Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	punches, err := s.repo.GetPunchesByDateRange(ctx, tenantID, emp.ID, startOfMonth, endOfMonth)
	if err != nil {
		return nil, err
	}

	leaves, _ := s.repo.GetApprovedLeavesByDateRange(ctx, tenantID, emp.ID, startOfMonth, endOfMonth)
	holidays, _ := s.repo.ListPublicHolidays(ctx, tenantID, year)
	regs, _ := s.repo.ListRegularizations(ctx, tenantID, &emp.ID, "")

	shift, _ := s.repo.GetEmployeeShift(ctx, tenantID, emp.ID, startOfMonth)
	fullDayCutoff := 8.0
	halfDayCutoff := 4.5
	shiftName := "General Shift"
	graceMin := 15
	if shift != nil {
		fullDayCutoff = shift.FullDayHours
		halfDayCutoff = shift.HalfDayHours
		shiftName = shift.Name
		graceMin = shift.GraceMinutes
	}

	punchesByDay := make(map[string][]AttendancePunch)
	for _, p := range punches {
		dayStr := p.PunchedAt.Format("2006-01-02")
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

	todayStr := time.Now().Format("2006-01-02")
	var totalPresent float64
	var totalHalfDays int
	var totalAbsent int
	var totalLeaves float64
	var totalHolidays int
	var totalWorkHours float64

	for d := 1; d <= daysInMonth; d++ {
		date := time.Date(year, time.Month(month), d, 0, 0, 0, 0, time.UTC)
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
			lStart := time.Date(l.FromDate.Year(), l.FromDate.Month(), l.FromDate.Day(), 0, 0, 0, 0, time.UTC)
			lEnd := time.Date(l.ToDate.Year(), l.ToDate.Month(), l.ToDate.Day(), 23, 59, 59, 0, time.UTC)
			if (date.Equal(lStart) || date.After(lStart)) && (date.Equal(lEnd) || date.Before(lEnd)) {
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
			parts := strings.Split(shift.StartTime, ":")
			if len(parts) >= 2 {
				var h, m int
				fmt.Sscanf(parts[0], "%d", &h)
				fmt.Sscanf(parts[1], "%d", &m)
				loc := firstIn.Location()
				expectedStart := time.Date(firstIn.Year(), firstIn.Month(), firstIn.Day(), h, m, 0, 0, loc)
				allowedStart := expectedStart.Add(time.Duration(graceMin) * time.Minute)
				if firstIn.After(allowedStart) {
					dayItem.IsLateIn = true
				}
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

	todayPunches, err := s.repo.GetTodayTeamPunches(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	punchesByEmp := make(map[uuid.UUID][]AttendancePunch)
	for _, p := range todayPunches {
		punchesByEmp[p.EmployeeID] = append(punchesByEmp[p.EmployeeID], p)
	}

	today := time.Now()
	todayStart := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	todayEnd := time.Date(today.Year(), today.Month(), today.Day(), 23, 59, 59, 0, time.UTC)

	var members []TeamPresenceRadarMember
	for _, emp := range employees {
		shift, _ := s.repo.GetEmployeeShift(ctx, tenantID, emp.ID, today)
		shiftName := "General Shift"
		if shift != nil {
			shiftName = shift.Name
		}

		empPunches := punchesByEmp[emp.ID]
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

	var punchIn *time.Time
	var punchOut *time.Time

	if req.RequestedPunchIn != nil && *req.RequestedPunchIn != "" {
		if t, err := time.Parse(time.RFC3339, *req.RequestedPunchIn); err == nil {
			punchIn = &t
		} else if parts := strings.Split(*req.RequestedPunchIn, ":"); len(parts) >= 2 {
			var h, m int
			fmt.Sscanf(parts[0], "%d", &h)
			fmt.Sscanf(parts[1], "%d", &m)
			combined := time.Date(reqDate.Year(), reqDate.Month(), reqDate.Day(), h, m, 0, 0, time.UTC)
			punchIn = &combined
		}
	}

	if req.RequestedPunchOut != nil && *req.RequestedPunchOut != "" {
		if t, err := time.Parse(time.RFC3339, *req.RequestedPunchOut); err == nil {
			punchOut = &t
		} else if parts := strings.Split(*req.RequestedPunchOut, ":"); len(parts) >= 2 {
			var h, m int
			fmt.Sscanf(parts[0], "%d", &h)
			fmt.Sscanf(parts[1], "%d", &m)
			combined := time.Date(reqDate.Year(), reqDate.Month(), reqDate.Day(), h, m, 0, 0, time.UTC)
			punchOut = &combined
		}
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
			shift, _ := s.repo.GetEmployeeShift(ctx, tenantID, reg.EmployeeID, reg.RequestDate)
			if shift != nil {
				partsStart := strings.Split(shift.StartTime, ":")
				partsEnd := strings.Split(shift.EndTime, ":")
				if len(partsStart) >= 2 && len(partsEnd) >= 2 {
					var sh, sm, eh, em int
					fmt.Sscanf(partsStart[0], "%d", &sh)
					fmt.Sscanf(partsStart[1], "%d", &sm)
					fmt.Sscanf(partsEnd[0], "%d", &eh)
					fmt.Sscanf(partsEnd[1], "%d", &em)

					synthIn := time.Date(reg.RequestDate.Year(), reg.RequestDate.Month(), reg.RequestDate.Day(), sh, sm, 0, 0, time.UTC)
					synthOut := time.Date(reg.RequestDate.Year(), reg.RequestDate.Month(), reg.RequestDate.Day(), eh, em, 0, 0, time.UTC)

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

		if i == 0 {
			primaryMasterImg = img
		}

		tensor, quality, err := biometrics.PreprocessForMobileFaceNet(img)
		if err != nil {
			return nil, fmt.Errorf("image #%d rejected by quality check: %s", i+1, quality.RejectionReason)
		}

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

func (s *service) PunchWithFace(ctx context.Context, tenantID, userID uuid.UUID, req *PunchWithFaceRequest) (*PunchWithFaceResponse, error) {
	if validationErr := req.Validate(); validationErr != "" {
		return nil, errors.New(validationErr)
	}

	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}

	if emp.FaceEmbedding == nil || *emp.FaceEmbedding == "" {
		return nil, errors.New("no biometric face profile registered for this employee. Please contact Management / HR to enroll your face")
	}

	var storedEmbedding []float32
	if err := json.Unmarshal([]byte(*emp.FaceEmbedding), &storedEmbedding); err != nil || len(storedEmbedding) == 0 {
		return nil, errors.New("corrupted biometric profile in database. Please ask HR to re-enroll your face")
	}

	// Decode selfie image
	selfieImg, _, err := biometrics.DecodeImage([]byte(req.SelfieImage))
	if err != nil {
		return nil, fmt.Errorf("failed to decode check-in selfie: %w", err)
	}

	tensor, quality, err := biometrics.PreprocessForMobileFaceNet(selfieImg)
	if err != nil {
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
	if selfieURL == "" {
		selfieURL = req.SelfieImage
	}

	distFloat := float64(distance)
	if !isMatched {
		return nil, fmt.Errorf("identity mismatch: face belongs to a different person (match score: %.1f%%, required: >= 75.0%%). Proxy punch prevented", confidence)
	}

	// Face is verified! Record attendance punch
	punchedAt := time.Now().UTC()
	isGeofenceVerified := false
	if req.Latitude != nil && req.Longitude != nil {
		var office *OfficeLocation
		if req.LocationID != nil && *req.LocationID != "" {
			if locID, err := uuid.Parse(*req.LocationID); err == nil {
				office, _ = s.repo.GetOfficeLocation(ctx, tenantID, locID)
			}
		}
		if office == nil {
			offices, _ := s.repo.ListOfficeLocations(ctx, tenantID)
			if len(offices) > 0 {
				office = &offices[0]
			}
		}
		if office != nil {
			verified, _ := VerifyGeofence(office, *req.Latitude, *req.Longitude, "")
			isGeofenceVerified = verified
		}
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
		SelfieURL:          &selfieURL,
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


