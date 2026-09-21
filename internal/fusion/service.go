package fusion

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"humora-backend/internal/hrms"
	"humora-backend/internal/work"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Service interface {
	GetMyWorkday(ctx context.Context, tenantID, userID uuid.UUID) (*MyWorkdayResponse, error)
	GetTeamCapacity(ctx context.Context, tenantID, userID uuid.UUID) (*TeamCapacityResponse, error)
	QuickLogWork(ctx context.Context, tenantID, userID, issueID uuid.UUID, timeSpentSeconds int, description string) error
	ReassignIssue(ctx context.Context, tenantID, issueID, targetAssigneeID uuid.UUID) error

	// 1. Leave-Aware Dynamic Sprint Capacity
	GetSprintCapacity(ctx context.Context, tenantID, sprintID uuid.UUID) (*SprintCapacityAnalysis, error)

	// 2. Zero-Effort Worklog-to-Timesheet Reconciliation
	GetWeeklyTimesheet(ctx context.Context, tenantID, userID uuid.UUID, weekStartStr string) (*WeeklyTimesheetReconciliation, error)
	SubmitWeeklyTimesheet(ctx context.Context, tenantID, userID uuid.UUID, req *SubmitTimesheetRequest) (*WeeklyTimesheetReconciliation, error)
	ReviewWeeklyTimesheet(ctx context.Context, tenantID, managerUserID, submissionID uuid.UUID, req *ReviewTimesheetRequest) error
	ListTeamTimesheets(ctx context.Context, tenantID uuid.UUID, status string) ([]WeeklyTimesheetReconciliation, error)

	// 3. Real-Time Feature & Epic Cost Engine
	GetCostAnalysis(ctx context.Context, tenantID uuid.UUID, projectID *uuid.UUID) ([]ProjectCostSummary, error)

	// 4. Developer Well-Being & Burnout Sentinel
	GetBurnoutSentinel(ctx context.Context, tenantID uuid.UUID) (*BurnoutSentinelReport, error)
}

type service struct {
	db          *sqlx.DB
	hrmsService hrms.Service
	hrmsRepo    hrms.Repository
	workService work.Service
	workRepo    work.Repository
}

func NewService(
	db *sqlx.DB,
	hrmsService hrms.Service,
	hrmsRepo hrms.Repository,
	workService work.Service,
	workRepo work.Repository,
) Service {
	return &service{
		db:          db,
		hrmsService: hrmsService,
		hrmsRepo:    hrmsRepo,
		workService: workService,
		workRepo:    workRepo,
	}
}

func (s *service) GetMyWorkday(ctx context.Context, tenantID, userID uuid.UUID) (*MyWorkdayResponse, error) {
	emp, err := s.hrmsRepo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}

	attSummary, _ := s.hrmsService.GetAttendanceSummary(ctx, tenantID, userID)

	punchedIn := false
	var lastPunchTime *time.Time
	todayHours := 0.0
	if attSummary != nil {
		punchedIn = attSummary.PunchedIn
		lastPunchTime = attSummary.LastPunchTime
		todayHours = attSummary.TodayHours
	}

	// 1. Fetch assigned active sprint / backlog issues ordered by priority
	queryIssues := `
		SELECT i.id, i.project_id, p.key AS project_key, i.issue_key, i.title, i.issue_type,
		       i.status_id, ws.name AS status_name, ws.category AS status_category, i.priority,
		       i.story_points, i.original_estimate_seconds, i.remaining_estimate_seconds
		FROM work_issues i
		JOIN work_workflow_statuses ws ON i.status_id = ws.id
		JOIN work_projects p ON i.project_id = p.id
		WHERE i.tenant_id = $1 AND i.assignee_id = $2 AND ws.category != 'done'
		ORDER BY 
			CASE i.priority 
				WHEN 'highest' THEN 1 
				WHEN 'high' THEN 2 
				WHEN 'medium' THEN 3 
				WHEN 'low' THEN 4 
				ELSE 5 
			END, 
			i.created_at ASC
		LIMIT 15
	`
	var focusTasks []MyWorkdayIssue
	_ = s.db.SelectContext(ctx, &focusTasks, queryIssues, tenantID, emp.ID)

	// 2. Fetch today's worklogs
	queryLogs := `
		SELECT wl.id, wl.issue_id, i.issue_key, i.title AS issue_title,
		       wl.time_spent_seconds, wl.started_at, wl.description, wl.is_billable
		FROM work_worklogs wl
		JOIN work_issues i ON wl.issue_id = i.id
		WHERE wl.tenant_id = $1 AND wl.employee_id = $2 AND wl.started_at >= CURRENT_DATE
		ORDER BY wl.started_at DESC
	`
	var todayWorklogs []MyWorkdayWorklog
	_ = s.db.SelectContext(ctx, &todayWorklogs, queryLogs, tenantID, emp.ID)

	totalSecondsLogged := 0
	for _, l := range todayWorklogs {
		totalSecondsLogged += l.TimeSpentSeconds
	}
	loggedHours := float64(totalSecondsLogged) / 3600.0

	// 3. Reconciliation calculation
	variance := todayHours - loggedHours
	syncPercent := 0.0
	if todayHours > 0 {
		syncPercent = math.Min(100, (loggedHours/todayHours)*100)
	}

	statusIndicator := "healthy"
	if todayHours > 2.0 && loggedHours < (todayHours-2.0) {
		statusIndicator = "under_logged"
	} else if loggedHours > (todayHours + 1.5) {
		statusIndicator = "over_logged"
	}

	// 4. Leave balances
	balances, _ := s.hrmsRepo.ListLeaveBalances(ctx, tenantID, emp.ID, time.Now().Year())
	var leaveSummaries []LeaveBalanceSummary
	for _, b := range balances {
		leaveSummaries = append(leaveSummaries, LeaveBalanceSummary{
			LeaveTypeID:   b.LeaveTypeID,
			LeaveTypeName: b.LeaveTypeName,
			LeaveTypeCode: b.LeaveTypeCode,
			Balance:       b.Balance,
			Used:          b.Used,
			Credited:      b.Credited,
		})
	}

	deptName := ""
	if emp.DepartmentName != nil {
		deptName = *emp.DepartmentName
	}
	desigTitle := ""
	if emp.DesignationTitle != nil {
		desigTitle = *emp.DesignationTitle
	}

	return &MyWorkdayResponse{
		EmployeeID:    emp.ID,
		EmployeeName:  fmt.Sprintf("%s %s", emp.FirstName, emp.LastName),
		WorkEmail:     emp.WorkEmail,
		Department:    deptName,
		Designation:   desigTitle,
		PunchedIn:     punchedIn,
		LastPunchTime: lastPunchTime,
		TodayHours:    todayHours,
		Reconciliation: DailyReconciliation{
			ClockedHours:    math.Round(todayHours*100) / 100,
			LoggedHours:     math.Round(loggedHours*100) / 100,
			VarianceHours:   math.Round(variance*100) / 100,
			SyncPercentage:  math.Round(syncPercent),
			StatusIndicator: statusIndicator,
		},
		FocusTasks:    focusTasks,
		TodayWorklogs: todayWorklogs,
		LeaveBalances: leaveSummaries,
	}, nil
}

func (s *service) GetTeamCapacity(ctx context.Context, tenantID, userID uuid.UUID) (*TeamCapacityResponse, error) {
	// List all employees in tenant
	employees, _, err := s.hrmsRepo.ListEmployees(ctx, tenantID, "", "", 100, 0)
	if err != nil {
		return nil, err
	}

	var members []TeamMemberCapacity
	clockedInCount := 0
	onLeaveCount := 0
	overallocatedCount := 0
	availableCount := 0

	for _, emp := range employees {
		// Check punch
		lastPunch, _ := s.hrmsRepo.GetLastPunch(ctx, tenantID, emp.ID)
		punchedIn := false
		presenceStatus := "offline"
		if lastPunch != nil && (lastPunch.PunchType == "in" || lastPunch.PunchType == "break_end") {
			punchedIn = true
			presenceStatus = "in_office"
			clockedInCount++
		}

		// Check active sprint load
		var stats struct {
			Count  int `db:"count"`
			Points int `db:"points"`
		}
		queryStats := `
			SELECT COUNT(*) AS count, COALESCE(SUM(i.story_points), 0) AS points
			FROM work_issues i
			JOIN work_workflow_statuses ws ON i.status_id = ws.id
			WHERE i.tenant_id = $1 AND i.assignee_id = $2 AND ws.category != 'done'
		`
		_ = s.db.GetContext(ctx, &stats, queryStats, tenantID, emp.ID)

		capacityStatus := "balanced"
		if stats.Points > 15 {
			capacityStatus = "overloaded"
			overallocatedCount++
		} else if stats.Points < 8 {
			capacityStatus = "available"
			availableCount++
		}

		// Check current focus issue (in_progress)
		var currentFocus *string
		var focusKey string
		queryFocus := `
			SELECT i.issue_key
			FROM work_issues i
			JOIN work_workflow_statuses ws ON i.status_id = ws.id
			WHERE i.tenant_id = $1 AND i.assignee_id = $2 AND ws.category = 'in_progress'
			LIMIT 1
		`
		if err := s.db.GetContext(ctx, &focusKey, queryFocus, tenantID, emp.ID); err == nil && focusKey != "" {
			currentFocus = &focusKey
		}

		deptName := ""
		if emp.DepartmentName != nil {
			deptName = *emp.DepartmentName
		}
		desigTitle := ""
		if emp.DesignationTitle != nil {
			desigTitle = *emp.DesignationTitle
		}

		members = append(members, TeamMemberCapacity{
			EmployeeID:         emp.ID,
			EmployeeName:       fmt.Sprintf("%s %s", emp.FirstName, emp.LastName),
			EmployeeCode:       emp.EmployeeCode,
			DesignationTitle:   desigTitle,
			DepartmentName:     deptName,
			PunchedIn:          punchedIn,
			PresenceStatus:     presenceStatus,
			AssignedIssueCount: stats.Count,
			TotalStoryPoints:   stats.Points,
			CapacityStatus:     capacityStatus,
			CurrentFocusIssue:  currentFocus,
		})
	}

	return &TeamCapacityResponse{
		TotalEngineers:     len(employees),
		ClockedInCount:     clockedInCount,
		OnLeaveCount:       onLeaveCount,
		OverallocatedCount: overallocatedCount,
		AvailableCount:     availableCount,
		Members:            members,
	}, nil
}

func (s *service) QuickLogWork(ctx context.Context, tenantID, userID, issueID uuid.UUID, timeSpentSeconds int, description string) error {
	emp, err := s.hrmsRepo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return errors.New("employee profile not found")
	}

	wl := &work.Worklog{
		ID:               uuid.New(),
		TenantID:         tenantID,
		IssueID:          issueID,
		EmployeeID:       emp.ID,
		TimeSpentSeconds: timeSpentSeconds,
		StartedAt:        time.Now().UTC(),
		Description:      &description,
		IsBillable:       true,
	}

	return s.workRepo.CreateWorklog(ctx, wl)
}

func (s *service) ReassignIssue(ctx context.Context, tenantID, issueID, targetAssigneeID uuid.UUID) error {
	query := `
		UPDATE work_issues
		SET assignee_id = $1, updated_at = NOW()
		WHERE tenant_id = $2 AND id = $3
	`
	_, err := s.db.ExecContext(ctx, query, targetAssigneeID, tenantID, issueID)
	return err
}

// 1. Leave-Aware Dynamic Sprint Capacity
func (s *service) GetSprintCapacity(ctx context.Context, tenantID, sprintID uuid.UUID) (*SprintCapacityAnalysis, error) {
	var sprint struct {
		ID        uuid.UUID  `db:"id"`
		ProjectID uuid.UUID  `db:"project_id"`
		Name      string     `db:"name"`
		StartDate *time.Time `db:"start_date"`
		EndDate   *time.Time `db:"end_date"`
		Key       string     `db:"key"`
	}
	querySprint := `
		SELECT s.id, s.project_id, s.name, s.start_date, s.end_date, p.key
		FROM work_sprints s
		JOIN work_projects p ON s.project_id = p.id
		WHERE s.id = $1 AND p.tenant_id = $2
	`
	if err := s.db.GetContext(ctx, &sprint, querySprint, sprintID, tenantID); err != nil {
		return nil, fmt.Errorf("sprint not found: %w", err)
	}

	startDate := time.Now().UTC()
	if sprint.StartDate != nil {
		startDate = *sprint.StartDate
	}
	endDate := startDate.AddDate(0, 0, 13) // Default 2 weeks
	if sprint.EndDate != nil {
		endDate = *sprint.EndDate
	}

	workingDays := 0
	for cur := startDate; !cur.After(endDate); cur = cur.AddDate(0, 0, 1) {
		if cur.Weekday() != time.Saturday && cur.Weekday() != time.Sunday {
			workingDays++
		}
	}
	if workingDays == 0 {
		workingDays = 10
	}

	employees, _, err := s.hrmsRepo.ListEmployees(ctx, tenantID, "", "", 100, 0)
	if err != nil {
		return nil, err
	}

	var engineers []EngineerCapacityItem
	var totalGross, totalLeaveHours, totalNet, totalCommittedHours float64
	var totalCommittedPoints int

	for _, emp := range employees {
		var approvedLeaveDays float64
		queryLeaves := `
			SELECT COALESCE(SUM(days_count), 0.0)
			FROM hrms_leave_requests
			WHERE tenant_id = $1 AND employee_id = $2 AND status = 'approved'
			  AND NOT (to_date < $3 OR from_date > $4)
		`
		_ = s.db.GetContext(ctx, &approvedLeaveDays, queryLeaves, tenantID, emp.ID, startDate, endDate)

		var committed struct {
			Seconds int `db:"seconds"`
			Points  int `db:"points"`
		}
		queryCommitted := `
			SELECT COALESCE(SUM(remaining_estimate_seconds), 0) AS seconds,
			       COALESCE(SUM(story_points), 0) AS points
			FROM work_issues
			WHERE sprint_id = $1 AND assignee_id = $2 AND tenant_id = $3
		`
		_ = s.db.GetContext(ctx, &committed, queryCommitted, sprintID, emp.ID, tenantID)

		grossHrs := float64(workingDays) * 8.0
		leaveHrs := approvedLeaveDays * 8.0
		netHrs := math.Max(0, grossHrs-leaveHrs)
		committedHrs := float64(committed.Seconds) / 3600.0
		if committedHrs == 0 && committed.Points > 0 {
			committedHrs = float64(committed.Points) * 6.0
		}

		hasConflict := false
		conflictReason := ""
		if committedHrs > netHrs {
			hasConflict = true
			conflictReason = fmt.Sprintf("%.1fd leave reduces bandwidth (%.0fh net capacity vs %.0fh committed)", approvedLeaveDays, netHrs, committedHrs)
		} else if approvedLeaveDays >= 3 && committed.Points > 5 {
			hasConflict = true
			conflictReason = fmt.Sprintf("%.1f days PTO during sprint cycle threatens %d committed story points", approvedLeaveDays, committed.Points)
		}

		desigTitle := "Software Engineer"
		if emp.DesignationTitle != nil && *emp.DesignationTitle != "" {
			desigTitle = *emp.DesignationTitle
		}

		engItem := EngineerCapacityItem{
			EmployeeID:         emp.ID,
			EmployeeName:       fmt.Sprintf("%s %s", emp.FirstName, emp.LastName),
			EmployeeCode:       emp.EmployeeCode,
			AvatarURL:          emp.AvatarURL,
			DesignationTitle:   desigTitle,
			WorkingDays:        workingDays,
			ApprovedLeaveDays:  approvedLeaveDays,
			GrossCapacityHours: grossHrs,
			NetCapacityHours:   netHrs,
			CommittedHours:     math.Round(committedHrs*10) / 10,
			CommittedPoints:    committed.Points,
			HasConflict:        hasConflict,
			ConflictReason:     conflictReason,
		}

		engineers = append(engineers, engItem)
		totalGross += grossHrs
		totalLeaveHours += leaveHrs
		totalNet += netHrs
		totalCommittedHours += committedHrs
		totalCommittedPoints += committed.Points
	}

	capacityUtil := 0.0
	if totalNet > 0 {
		capacityUtil = math.Round((totalCommittedHours / totalNet) * 100)
	}

	overcommitted := totalCommittedHours > totalNet
	alertMsg := ""
	if overcommitted {
		alertMsg = fmt.Sprintf("Sprint capacity deficit! Team is overcommitted by %.1f hours due to approved leave deductions.", totalCommittedHours-totalNet)
	}

	return &SprintCapacityAnalysis{
		SprintID:               sprint.ID,
		SprintName:             sprint.Name,
		ProjectID:              sprint.ProjectID,
		ProjectKey:             sprint.Key,
		StartDate:              &startDate,
		EndDate:                &endDate,
		WorkingDays:            workingDays,
		TotalEngineers:         len(engineers),
		GrossCapacityHours:     totalGross,
		LeaveHoursDeducted:     totalLeaveHours,
		NetCapacityHours:       totalNet,
		CommittedHours:         math.Round(totalCommittedHours*10) / 10,
		CommittedPoints:        totalCommittedPoints,
		CapacityUtilizationPct: capacityUtil,
		Overcommitted:          overcommitted,
		AlertMessage:           alertMsg,
		Engineers:              engineers,
	}, nil
}

// 2. Worklog-to-Timesheet Reconciliation
func (s *service) GetWeeklyTimesheet(ctx context.Context, tenantID, userID uuid.UUID, weekStartStr string) (*WeeklyTimesheetReconciliation, error) {
	emp, err := s.hrmsRepo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}

	var monday time.Time
	if weekStartStr != "" {
		parsed, err := time.Parse("2006-01-02", weekStartStr)
		if err == nil {
			monday = parsed
		}
	}
	if monday.IsZero() {
		now := time.Now().UTC()
		weekday := int(now.Weekday())
		offset := (weekday + 6) % 7 // Monday = 0, Sunday = 6
		monday = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -offset)
	}

	sunday := monday.AddDate(0, 0, 6)

	var sub struct {
		ID               uuid.UUID  `db:"id"`
		Status           string     `db:"status"`
		SubmittedAt      *time.Time `db:"submitted_at"`
		ReviewerComments *string    `db:"reviewer_comments"`
		ReviewerName     *string    `db:"reviewer_name"`
	}
	querySub := `
		SELECT ts.id, ts.status, ts.submitted_at, ts.reviewer_comments,
		       COALESCE(rev_e.first_name || ' ' || rev_e.last_name, u.email, '') as reviewer_name
		FROM hrms_timesheet_submissions ts
		LEFT JOIN users u ON ts.reviewed_by = u.id
		LEFT JOIN hrms_employees rev_e ON rev_e.user_id = u.id
		WHERE ts.tenant_id = $1 AND ts.employee_id = $2 AND ts.week_start_date = $3
	`
	var submissionID *uuid.UUID
	submissionStatus := "draft"
	var submittedAt *time.Time
	var reviewerComments *string
	var reviewerName *string

	if err := s.db.GetContext(ctx, &sub, querySub, tenantID, emp.ID, monday.Format("2006-01-02")); err == nil && sub.ID != uuid.Nil {
		submissionID = &sub.ID
		submissionStatus = sub.Status
		submittedAt = sub.SubmittedAt
		reviewerComments = sub.ReviewerComments
		reviewerName = sub.ReviewerName
	}

	var days []DailyTimesheetItem
	var totalClocked, totalLogged float64
	daysOfWeek := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}

	for i := 0; i < 7; i++ {
		dayDate := monday.AddDate(0, 0, i)
		dayDateStr := dayDate.Format("2006-01-02")
		nextDay := dayDate.AddDate(0, 0, 1)

		var clockedHours float64
		var punchCount int
		_ = s.db.GetContext(ctx, &punchCount, `SELECT COUNT(*) FROM hrms_attendance_punches WHERE tenant_id = $1 AND employee_id = $2 AND punched_at >= $3 AND punched_at < $4`, tenantID, emp.ID, dayDate, nextDay)
		if punchCount > 0 {
			clockedHours = 8.0
		}

		var rawLogs []struct {
			IssueID          uuid.UUID `db:"issue_id"`
			IssueKey         string    `db:"issue_key"`
			IssueTitle       string    `db:"issue_title"`
			TimeSpentSeconds int       `db:"time_spent_seconds"`
			IsBillable       bool      `db:"is_billable"`
		}
		queryLogs := `
			SELECT wl.issue_id, i.issue_key, i.title AS issue_title,
			       wl.time_spent_seconds, wl.is_billable
			FROM work_worklogs wl
			JOIN work_issues i ON wl.issue_id = i.id
			WHERE wl.tenant_id = $1 AND wl.employee_id = $2
			  AND wl.started_at >= $3 AND wl.started_at < $4
			ORDER BY wl.started_at ASC
		`
		_ = s.db.SelectContext(ctx, &rawLogs, queryLogs, tenantID, emp.ID, dayDate, nextDay)

		var worklogs []TimesheetIssueWorklog
		dayLogged := 0.0
		for _, rl := range rawLogs {
			hrs := float64(rl.TimeSpentSeconds) / 3600.0
			worklogs = append(worklogs, TimesheetIssueWorklog{
				IssueID:          rl.IssueID,
				IssueKey:         rl.IssueKey,
				IssueTitle:       rl.IssueTitle,
				TimeSpentSeconds: rl.TimeSpentSeconds,
				Hours:            math.Round(hrs*100) / 100,
				IsBillable:       rl.IsBillable,
			})
			dayLogged += hrs
		}

		variance := clockedHours - dayLogged
		status := "synced"
		if i >= 5 {
			status = "weekend"
		} else if clockedHours > 2.0 && dayLogged < (clockedHours-2.0) {
			status = "under_logged"
		} else if dayLogged > (clockedHours + 1.5) {
			status = "over_logged"
		}

		days = append(days, DailyTimesheetItem{
			Date:          dayDateStr,
			DayOfWeek:     daysOfWeek[i],
			ClockedHours:  math.Round(clockedHours*10) / 10,
			LoggedHours:   math.Round(dayLogged*10) / 10,
			VarianceHours: math.Round(variance*10) / 10,
			Status:        status,
			Worklogs:      worklogs,
		})

		totalClocked += clockedHours
		totalLogged += dayLogged
	}

	totalVariance := totalClocked - totalLogged
	syncPct := 0.0
	if totalClocked > 0 {
		syncPct = math.Min(100, (totalLogged/totalClocked)*100)
	}

	return &WeeklyTimesheetReconciliation{
		SubmissionID:      submissionID,
		EmployeeID:        emp.ID,
		EmployeeName:      fmt.Sprintf("%s %s", emp.FirstName, emp.LastName),
		WeekStartDate:     monday.Format("2006-01-02"),
		WeekEndDate:       sunday.Format("2006-01-02"),
		TotalClockedHours: math.Round(totalClocked*10) / 10,
		TotalLoggedHours:  math.Round(totalLogged*10) / 10,
		VarianceHours:     math.Round(totalVariance*10) / 10,
		SyncPercentage:    math.Round(syncPct),
		SubmissionStatus:  submissionStatus,
		SubmittedAt:       submittedAt,
		ReviewedBy:        reviewerName,
		ReviewerComments:  reviewerComments,
		Days:              days,
	}, nil
}

func (s *service) SubmitWeeklyTimesheet(ctx context.Context, tenantID, userID uuid.UUID, req *SubmitTimesheetRequest) (*WeeklyTimesheetReconciliation, error) {
	sheet, err := s.GetWeeklyTimesheet(ctx, tenantID, userID, req.WeekStartDate)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	subID := uuid.New()
	query := `
		INSERT INTO hrms_timesheet_submissions (
			id, tenant_id, employee_id, week_start_date, week_end_date,
			total_clocked_hours, total_logged_hours, variance_hours, status, notes, submitted_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, 'submitted', $9, $10
		) ON CONFLICT (tenant_id, employee_id, week_start_date) DO UPDATE SET
			total_clocked_hours = EXCLUDED.total_clocked_hours,
			total_logged_hours = EXCLUDED.total_logged_hours,
			variance_hours = EXCLUDED.variance_hours,
			status = 'submitted',
			notes = EXCLUDED.notes,
			submitted_at = EXCLUDED.submitted_at
		RETURNING id
	`
	var persistedID uuid.UUID
	err = s.db.QueryRowContext(ctx, query,
		subID, tenantID, sheet.EmployeeID, sheet.WeekStartDate, sheet.WeekEndDate,
		sheet.TotalClockedHours, sheet.TotalLoggedHours, sheet.VarianceHours, req.Notes, now,
	).Scan(&persistedID)
	if err != nil {
		return nil, fmt.Errorf("failed to submit timesheet: %w", err)
	}

	sheet.SubmissionID = &persistedID
	sheet.SubmissionStatus = "submitted"
	sheet.SubmittedAt = &now
	return sheet, nil
}

func (s *service) ReviewWeeklyTimesheet(ctx context.Context, tenantID, managerUserID, submissionID uuid.UUID, req *ReviewTimesheetRequest) error {
	now := time.Now().UTC()
	query := `
		UPDATE hrms_timesheet_submissions
		SET status = $1, reviewed_by = $2, reviewed_at = $3, reviewer_comments = $4, updated_at = $5
		WHERE id = $6 AND tenant_id = $7
	`
	res, err := s.db.ExecContext(ctx, query, req.Status, managerUserID, now, req.ReviewerComments, now, submissionID, tenantID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("timesheet submission not found")
	}
	return nil
}

func (s *service) ListTeamTimesheets(ctx context.Context, tenantID uuid.UUID, status string) ([]WeeklyTimesheetReconciliation, error) {
	baseQuery := `
		SELECT ts.id, ts.employee_id, ts.week_start_date, ts.week_end_date,
		       ts.total_clocked_hours, ts.total_logged_hours, ts.variance_hours,
		       ts.status, ts.submitted_at, ts.reviewer_comments,
		       e.first_name || ' ' || e.last_name as employee_name,
		       COALESCE(rev_e.first_name || ' ' || rev_e.last_name, u.email, '') as reviewer_name
		FROM hrms_timesheet_submissions ts
		JOIN hrms_employees e ON ts.employee_id = e.id
		LEFT JOIN users u ON ts.reviewed_by = u.id
		LEFT JOIN hrms_employees rev_e ON rev_e.user_id = u.id
		WHERE ts.tenant_id = $1
	`
	args := []interface{}{tenantID}
	if status != "" {
		baseQuery += " AND ts.status = $2"
		args = append(args, status)
	}
	baseQuery += " ORDER BY ts.week_start_date DESC, ts.submitted_at DESC"

	var rows []struct {
		ID                uuid.UUID  `db:"id"`
		EmployeeID        uuid.UUID  `db:"employee_id"`
		EmployeeName      string     `db:"employee_name"`
		WeekStartDate     time.Time  `db:"week_start_date"`
		WeekEndDate       time.Time  `db:"week_end_date"`
		TotalClockedHours float64    `db:"total_clocked_hours"`
		TotalLoggedHours  float64    `db:"total_logged_hours"`
		VarianceHours     float64    `db:"variance_hours"`
		Status            string     `db:"status"`
		SubmittedAt       *time.Time `db:"submitted_at"`
		ReviewerComments  *string    `db:"reviewer_comments"`
		ReviewerName      *string    `db:"reviewer_name"`
	}

	if err := s.db.SelectContext(ctx, &rows, baseQuery, args...); err != nil {
		return nil, err
	}

	var results []WeeklyTimesheetReconciliation
	for _, r := range rows {
		syncPct := 0.0
		if r.TotalClockedHours > 0 {
			syncPct = math.Min(100, (r.TotalLoggedHours/r.TotalClockedHours)*100)
		}
		idCopy := r.ID
		results = append(results, WeeklyTimesheetReconciliation{
			SubmissionID:      &idCopy,
			EmployeeID:        r.EmployeeID,
			EmployeeName:      r.EmployeeName,
			WeekStartDate:     r.WeekStartDate.Format("2006-01-02"),
			WeekEndDate:       r.WeekEndDate.Format("2006-01-02"),
			TotalClockedHours: r.TotalClockedHours,
			TotalLoggedHours:  r.TotalLoggedHours,
			VarianceHours:     r.VarianceHours,
			SyncPercentage:    math.Round(syncPct),
			SubmissionStatus:  r.Status,
			SubmittedAt:       r.SubmittedAt,
			ReviewedBy:        r.ReviewerName,
			ReviewerComments:  r.ReviewerComments,
		})
	}
	return results, nil
}

// 3. Real-Time Feature & Epic Cost Engine
func (s *service) GetCostAnalysis(ctx context.Context, tenantID uuid.UUID, projectID *uuid.UUID) ([]ProjectCostSummary, error) {
	queryProjects := `SELECT id, key, name FROM work_projects WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	if projectID != nil {
		queryProjects += " AND id = $2"
		args = append(args, *projectID)
	}

	var projects []struct {
		ID   uuid.UUID `db:"id"`
		Key  string    `db:"key"`
		Name string    `db:"name"`
	}
	if err := s.db.SelectContext(ctx, &projects, queryProjects, args...); err != nil {
		return nil, err
	}

	var summaries []ProjectCostSummary

	for _, p := range projects {
		queryEpics := `
			SELECT id, issue_key, title, COALESCE(original_estimate_seconds, 0) as estimate_seconds
			FROM work_issues
			WHERE tenant_id = $1 AND project_id = $2 AND issue_type = 'epic'
			ORDER BY created_at ASC
		`
		var epics []struct {
			ID              uuid.UUID `db:"id"`
			IssueKey        string    `db:"issue_key"`
			Title           string    `db:"title"`
			EstimateSeconds int       `db:"estimate_seconds"`
		}
		_ = s.db.SelectContext(ctx, &epics, queryEpics, tenantID, p.ID)

		var epicAnalyses []EpicCostAnalysis
		var totalProjEstCost, totalProjActualCost float64

		for _, ep := range epics {
			var childIssueIDs []uuid.UUID
			queryChildren := `SELECT id FROM work_issues WHERE tenant_id = $1 AND (parent_id = $2 OR id = $2)`
			_ = s.db.SelectContext(ctx, &childIssueIDs, queryChildren, tenantID, ep.ID)

			var contributors []CostContributorItem
			var epicActualHours, epicActualCost float64

			if len(childIssueIDs) > 0 {
				queryContribs, qargs, err := sqlx.In(`
					SELECT e.id AS employee_id,
					       e.first_name || ' ' || e.last_name AS employee_name,
					       COALESCE(des.title, 'Software Engineer') AS designation_title,
					       COALESCE(e.hourly_cost_rate, 75.00) AS hourly_rate,
					       SUM(wl.time_spent_seconds) AS total_seconds
					FROM work_worklogs wl
					JOIN hrms_employees e ON wl.employee_id = e.id
					LEFT JOIN hrms_designations des ON e.designation_id = des.id
					WHERE wl.tenant_id = ? AND wl.issue_id IN (?)
					GROUP BY e.id, e.first_name, e.last_name, des.title, e.hourly_cost_rate
				`, tenantID, childIssueIDs)

				if err == nil {
					queryContribs = s.db.Rebind(queryContribs)
					var rawContribs []struct {
						EmployeeID       uuid.UUID `db:"employee_id"`
						EmployeeName     string    `db:"employee_name"`
						DesignationTitle string    `db:"designation_title"`
						HourlyRate       float64   `db:"hourly_rate"`
						TotalSeconds     int       `db:"total_seconds"`
					}
					_ = s.db.SelectContext(ctx, &rawContribs, queryContribs, qargs...)

					for _, rc := range rawContribs {
						hrs := float64(rc.TotalSeconds) / 3600.0
						cost := hrs * rc.HourlyRate
						contributors = append(contributors, CostContributorItem{
							EmployeeID:       rc.EmployeeID,
							EmployeeName:     rc.EmployeeName,
							DesignationTitle: rc.DesignationTitle,
							HourlyRate:       rc.HourlyRate,
							LoggedHours:      math.Round(hrs*10) / 10,
							IncurredCost:     math.Round(cost*100) / 100,
						})
						epicActualHours += hrs
						epicActualCost += cost
					}
				}
			}

			estHrs := float64(ep.EstimateSeconds) / 3600.0
			if estHrs == 0 {
				estHrs = 40.0
			}
			estBudget := estHrs * 75.00
			variance := estBudget - epicActualCost
			burnPct := 0.0
			if estBudget > 0 {
				burnPct = math.Round((epicActualCost / estBudget) * 100)
			}

			epicAnalyses = append(epicAnalyses, EpicCostAnalysis{
				EpicID:          ep.ID,
				EpicKey:         ep.IssueKey,
				EpicTitle:       ep.Title,
				ProjectKey:      p.Key,
				EstimatedHours:  math.Round(estHrs*10) / 10,
				EstimatedBudget: math.Round(estBudget),
				ActualHours:     math.Round(epicActualHours*10) / 10,
				ActualCost:      math.Round(epicActualCost),
				Variance:        math.Round(variance),
				BudgetBurnPct:   burnPct,
				Contributors:    contributors,
			})

			totalProjEstCost += estBudget
			totalProjActualCost += epicActualCost
		}

		summaries = append(summaries, ProjectCostSummary{
			ProjectID:          p.ID,
			ProjectKey:         p.Key,
			ProjectName:        p.Name,
			TotalEpics:         len(epicAnalyses),
			TotalEstimatedCost: math.Round(totalProjEstCost),
			TotalIncurredCost:  math.Round(totalProjActualCost),
			Epics:              epicAnalyses,
		})
	}

	return summaries, nil
}

// 4. Developer Well-Being & Burnout Sentinel
func (s *service) GetBurnoutSentinel(ctx context.Context, tenantID uuid.UUID) (*BurnoutSentinelReport, error) {
	employees, _, err := s.hrmsRepo.ListEmployees(ctx, tenantID, "", "", 100, 0)
	if err != nil {
		return nil, err
	}

	var members []MemberBurnoutRisk
	optimalCount := 0
	moderateCount := 0
	highRiskCount := 0
	totalScoreSum := 0

	now := time.Now().UTC()
	thirtyDaysAgo := now.AddDate(0, 0, -30)

	for _, emp := range employees {
		var lateDays int
		queryLate := `
			SELECT COUNT(DISTINCT date_trunc('day', punched_at))
			FROM hrms_attendance_punches
			WHERE tenant_id = $1 AND employee_id = $2
			  AND punched_at >= $3
			  AND punch_type IN ('out', 'break_start')
			  AND EXTRACT(HOUR FROM punched_at) >= 20
		`
		_ = s.db.GetContext(ctx, &lateDays, queryLate, tenantID, emp.ID, thirtyDaysAgo)

		var weekendSeconds int
		queryWeekend := `
			SELECT COALESCE(SUM(time_spent_seconds), 0)
			FROM work_worklogs
			WHERE tenant_id = $1 AND employee_id = $2
			  AND started_at >= $3
			  AND EXTRACT(DOW FROM started_at) IN (0, 6)
		`
		_ = s.db.GetContext(ctx, &weekendSeconds, queryWeekend, tenantID, emp.ID, thirtyDaysAgo)
		weekendHours := float64(weekendSeconds) / 3600.0

		var activePoints int
		querySprintPts := `
			SELECT COALESCE(SUM(i.story_points), 0)
			FROM work_issues i
			JOIN work_workflow_statuses ws ON i.status_id = ws.id
			WHERE i.tenant_id = $1 AND i.assignee_id = $2 AND ws.category != 'done'
		`
		_ = s.db.GetContext(ctx, &activePoints, querySprintPts, tenantID, emp.ID)

		var lastLeaveTo *time.Time
		queryLastLeave := `
			SELECT to_date
			FROM hrms_leave_requests
			WHERE tenant_id = $1 AND employee_id = $2 AND status = 'approved'
			ORDER BY to_date DESC
			LIMIT 1
		`
		_ = s.db.GetContext(ctx, &lastLeaveTo, queryLastLeave, tenantID, emp.ID)
		daysSinceLeave := 45
		if lastLeaveTo != nil {
			diff := now.Sub(*lastLeaveTo).Hours() / 24.0
			if diff > 0 {
				daysSinceLeave = int(diff)
			} else {
				daysSinceLeave = 0
			}
		}

		score := (lateDays * 14) + int(weekendHours * 10) + (activePoints * 2)
		if daysSinceLeave > 60 {
			score += 15
		}
		if score > 100 {
			score = 100
		}

		tier := "optimal"
		primaryTrigger := "Workload balanced with consistent hours"
		recommendation := "Continue standard sprint pacing"

		if score >= 65 {
			tier = "high"
			highRiskCount++
			if lateDays >= 3 {
				primaryTrigger = fmt.Sprintf("High overtime pressure (%d late-night checkouts past 8:30 PM)", lateDays)
				recommendation = "Immediate manager 1:1 suggested. Cap evening work."
			} else if activePoints >= 15 {
				primaryTrigger = fmt.Sprintf("Severe sprint overload (%d active story points)", activePoints)
				recommendation = "Reassign 2-3 non-critical backlog tickets to available peers."
			} else {
				primaryTrigger = fmt.Sprintf("Weekend burnout (%0.1f weekend hours logged)", weekendHours)
				recommendation = "Institute no-weekend work guidelines."
			}
		} else if score >= 35 {
			tier = "moderate"
			moderateCount++
			if activePoints > 10 {
				primaryTrigger = fmt.Sprintf("Elevated sprint velocity load (%d points)", activePoints)
				recommendation = "Monitor ticket progress during daily standup."
			} else if daysSinceLeave > 50 {
				primaryTrigger = fmt.Sprintf("%d days without taking PTO", daysSinceLeave)
				recommendation = "Encourage scheduling a recharge day."
			} else {
				primaryTrigger = "Occasional extended hours"
				recommendation = "Check for sprint blockers."
			}
		} else {
			optimalCount++
		}

		totalScoreSum += score

		deptName := "Engineering"
		if emp.DepartmentName != nil && *emp.DepartmentName != "" {
			deptName = *emp.DepartmentName
		}
		desigTitle := "Software Engineer"
		if emp.DesignationTitle != nil && *emp.DesignationTitle != "" {
			desigTitle = *emp.DesignationTitle
		}

		members = append(members, MemberBurnoutRisk{
			EmployeeID:           emp.ID,
			EmployeeName:         fmt.Sprintf("%s %s", emp.FirstName, emp.LastName),
			EmployeeCode:         emp.EmployeeCode,
			DepartmentName:       deptName,
			DesignationTitle:     desigTitle,
			RiskScore:            score,
			RiskTier:             tier,
			LateCheckoutDays:     lateDays,
			WeekendHoursLogged:   math.Round(weekendHours*10) / 10,
			ActiveSprintPoints:   activePoints,
			DaysSinceLastLeave:   daysSinceLeave,
			PrimaryRiskTrigger:   primaryTrigger,
			ActionRecommendation: recommendation,
		})
	}

	teamIndex := 20
	if len(members) > 0 {
		teamIndex = totalScoreSum / len(members)
	}

	overallTier := "optimal"
	if teamIndex >= 65 {
		overallTier = "high"
	} else if teamIndex >= 35 {
		overallTier = "moderate"
	}

	var sysRecs []string
	if highRiskCount > 0 {
		sysRecs = append(sysRecs, fmt.Sprintf("%d engineer(s) in critical burnout zone; rebalance active sprint story points", highRiskCount))
	}
	if moderateCount > 0 {
		sysRecs = append(sysRecs, "Encourage engineers with >50 days without PTO to schedule wellness leave")
	}
	sysRecs = append(sysRecs, "Sprint velocity baseline is healthy across core engineering squads")

	return &BurnoutSentinelReport{
		TenantID:              tenantID,
		TeamBurnoutIndex:      teamIndex,
		OverallTier:           overallTier,
		TotalEngineers:        len(members),
		OptimalCount:          optimalCount,
		ModerateCount:         moderateCount,
		HighRiskCount:         highRiskCount,
		Members:               members,
		SystemRecommendations: sysRecs,
	}, nil
}
