# 06. Unified Integration & Data Flows (HRMS $\times$ Jira)

Because **Zoho People** and **Jira** share the exact same Go backend and PostgreSQL database, all cross-domain operations occur via **sub-millisecond ACID transactions**. This document walks through the 6 native data flows that make Humora superior to separate software tools.

---

## Flow 1: Sprint Capacity Auto-Calculation from HR Shifts & Leaves

### The Problem in Traditional Tools
In Jira, a team commits to 80 story points based on a theoretical 40 hours/week per dev. Mid-sprint, 2 developers go on approved leave in Zoho People, causing the sprint to fail.

### The Humora Native Flow
```
[ Scrum Master selects Sprint Dates: Oct 1 - Oct 14 (10 Working Days) ]
                                │
                                ▼
         Go Backend: CalculateSprintCapacity(project_id, start_date, end_date)
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
  Query Project Developers             Query HRMS Leaves & Shift Tables
  (List of 6 active engineers)         (Active shifts, approved leaves, holidays)
            │                                       │
            └───────────────────┬───────────────────┘
                                │
                                ▼
      [ Mathematical Calculation per Developer ]
      • Dev 1: 10 days * 8h = 80h
      • Dev 2: 10 days * 8h - 16h (2 days approved leave) = 64h
      • Dev 3: 10 days * 4h (part-time shift roster) = 40h
      • Dev 4, 5, 6: 10 days * 8h = 240h
      • Public Holiday on Oct 2 (All Devs -8h) = -48h
                                │
                                ▼
      [ Total Deterministic Capacity = 376 Hours ]
      Auto-saved in `jira_sprints.calculated_capacity_hours`
```

---

## Flow 2: Live Ticket Timer to HR Payroll Timesheets

### The Problem in Traditional Tools
Engineers log time in Jira tickets, then must manually re-enter their hours into Zoho Timesheets at the end of the week for payroll.

### The Humora Native Flow
```
[ Developer Clicks "Stop Timer" on Jira Issue HUM-421 ]
                       │
                       ▼
POST /api/v1/worklogs/stop
{
  "issue_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "seconds_spent": 7200, // 2 Hours
  "description": "Implemented geofence polygon validation"
}
                       │
                       ▼
            BEGIN TRANSACTION (PostgreSQL)
  1. INSERT INTO jira_worklogs (issue_id, employee_id, time_spent_seconds)
  2. UPDATE jira_issues SET remaining_estimate_seconds = remaining_estimate_seconds - 7200
  3. INSERT INTO hrms_timesheet_entries (
       employee_id,
       project_id,
       task_id,
       hours_logged,
       billable_flag,
       client_cost_center
     ) VALUES (..., 2.0, TRUE, 'Enterprise-Client-A')
  4. UPDATE hrms_project_costs SET
       incurred_cost = incurred_cost + (employee.hourly_cost_rate * 2.0)
  5. INSERT INTO audit_ledger (cryptographic hash block)
            COMMIT TRANSACTION
                       │
                       ▼
     [ Broadcast to WebSocket Room: project:HUM ]
     - Jira Kanban board updates remaining estimate progress bar
     - HR Timesheet portal reflects 2.0 billable hours for today
     - Mobile app status bar timer dismisses
```

---

## Flow 3: Geofenced Punch-in $\rightarrow$ Live Jira Board Presence

```
[ Mobile App detects Employee inside Office Geofence ]
                       │
                       ▼
POST /api/v1/attendance/punch-in
                       │
                       ▼
1. Validate GPS coordinates inside polygon & check anti-mock location
2. INSERT INTO hrms_attendance_punches (punch_type = 'in', location_verified = true)
3. UPDATE users SET presence_status = 'in_office_active'
                       │
                       ▼
WebSocket Hub emits `PRESENCE_CHANGE` to active Jira boards
                       │
                       ▼
[ Result on React & Mobile Kanban Boards ]
Employee avatar glows GREEN with an "In Office" badge.
Teammates immediately know they can assign high-priority reviews.
```

---

## Flow 4: On-Duty Shift Routing for P0/Critical Bugs

```
[ New Critical Bug Created: "Payment Gateway Connection Timeout" ]
                       │
                       ▼
Automation Rule Trigger: `issue.type == 'Bug' && issue.priority == 'Highest'`
                       │
                       ▼
Go Engine Queries Active On-Duty Shift Roster:
SELECT e.id, e.work_email 
FROM hrms_employees e
JOIN hrms_shift_rosters sr ON sr.employee_id = e.id
JOIN hrms_attendance_punches ap ON ap.employee_id = e.id
WHERE sr.shift_id = CURRENT_ACTIVE_SHIFT_ID
  AND ap.punch_type = 'in' 
  AND e.department_id = 'INFRA_DEPT_ID'
ORDER BY e.current_active_tickets ASC
LIMIT 1;
                       │
                       ▼
[ Result ]
Bug is automatically assigned to the on-duty engineer currently on shift.
Push notification and high-priority SMS/Slack alert dispatched immediately.
```

---

## Flow 5: Objective Performance Scorecard Aggregation

```
[ HR Initiates Q3 Appraisal Cycle for Engineering Department ]
                       │
                       ▼
Go Backend executes deterministic aggregation query against Jira tables:
SELECT 
    COUNT(*) as total_assigned,
    COUNT(CASE WHEN status_id = 'DONE_STATUS_ID' THEN 1 END) as total_completed,
    COALESCE(SUM(story_points), 0) as total_points_delivered,
    AVG(CASE WHEN resolved_at <= due_date THEN 1.0 ELSE 0.0 END) * 100 as on_time_delivery_pct,
    COUNT(CASE WHEN reopen_count > 0 THEN 1 END) as quality_reopen_count
FROM jira_issues
WHERE assignee_id = 'EMP-007' 
  AND created_at BETWEEN '2026-07-01' AND '2026-09-30';
                       │
                       ▼
Values populated automatically into the HR Performance Scorecard:
- Velocity Score: 94%
- Delivery SLA Score: 98%
- Quality Metric: 0 Reopens
Zero manager bias. 100% objective, verifiable performance evaluation.
```

---

## Flow 6: Atomic Employee Offboarding & Task Handover

```
[ HR Approves Employee Resignation / Exit for Date: Oct 31 ]
                       │
                       ▼
POST /api/v1/hrms/exit/process-clearance
                       │
                       ▼
            BEGIN TRANSACTION
  1. Revoke active JWT tokens and mobile device public keys for User
  2. Query all open Jira issues where `assignee_id = departing_employee_id`
  3. Reassign all open issues to the designated Successor / Team Lead
  4. Auto-remove departing employee from active sprint capacity
  5. Mark all assigned assets (laptops, access keys) as "Pending Return"
  6. Calculate Full & Final (F&F) balance:
     Payable Days + Encashable Leaves - Notice Shortfall
  7. Log cryptographic audit entry
            COMMIT TRANSACTION
                       │
                       ▼
No orphaned tickets, no lingering system access, no payroll errors.
```
