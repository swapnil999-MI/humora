package hrms

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Time zones for attendance.
//
// The server stores and compares instants in UTC. Questions that depend on a wall clock
// (which day a punch belongs to, "today", was this check-in late, what instant is "09:00
// on the 14th") are answered strictly in the time zone saved on the employee's shift. That
// zone is captured from the admin dashboard when the shift is created and never changes.
// Nothing falls back to a guessed zone: an employee without a shift cannot punch.

var zoneCache sync.Map // name -> *time.Location

// LoadZone returns the IANA time zone, or UTC if the name is empty or not a known zone.
func LoadZone(name string) *time.Location {
	if name == "" {
		return time.UTC
	}
	if loc, ok := zoneCache.Load(name); ok {
		return loc.(*time.Location)
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		loc = time.UTC
	}
	zoneCache.Store(name, loc)
	return loc
}

// ValidZone reports whether name is an IANA time zone this server knows.
func ValidZone(name string) bool {
	if name == "" || name == "Local" {
		return false
	}
	_, err := time.LoadLocation(name)
	return err == nil
}

// Location is the time zone saved on the shift when it was created.
func (s *Shift) Location() *time.Location {
	if s == nil {
		return time.UTC
	}
	return LoadZone(s.TimeZone)
}

// DayStart is local midnight of the calendar day t falls on in loc.
func DayStart(t time.Time, loc *time.Location) time.Time {
	l := t.In(loc)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, loc)
}

// ClockOn returns the instant of the wall-clock time "HH:MM[:SS]" on the given calendar
// date (year, month, day as written) in loc.
func ClockOn(date time.Time, clock string, loc *time.Location) (time.Time, bool) {
	t, err := time.Parse("15:04:05", normalizeTimeString(clock))
	if err != nil {
		return time.Time{}, false
	}
	return time.Date(date.Year(), date.Month(), date.Day(), t.Hour(), t.Minute(), t.Second(), 0, loc), true
}

// ErrNoShift: punching needs a shift, because the shift's saved time zone decides the day.
var ErrNoShift = errors.New("no shift is assigned to you yet. ask HR or an admin to assign your shift before punching in")

// EmployeeLocation is the saved time zone of the employee's shift on the given instant. For
// dates before their first assignment it uses their earliest shift. An employee who has
// never had a shift gets UTC (only for showing history; they cannot punch).
func EmployeeLocation(ctx context.Context, repo Repository, tenantID, employeeID uuid.UUID, at time.Time) (*time.Location, *Shift) {
	shift, _ := repo.GetEmployeeShift(ctx, tenantID, employeeID, at)
	if shift == nil {
		shift, _ = repo.GetFirstEmployeeShift(ctx, tenantID, employeeID)
	}
	if shift != nil {
		return shift.Location(), shift
	}
	return time.UTC, nil
}

// PunchState is "out", "working" or "on_break" from the employee's last punch. A punch older
// than 20 hours no longer counts, so a night shift can check out after midnight and a
// forgotten check-out does not block the next day. The apps' check-in/out button and the
// punch check below both use this.
func PunchState(last *AttendancePunch) string {
	if last == nil || time.Since(last.PunchedAt) >= 20*time.Hour {
		return "out"
	}
	switch last.PunchType {
	case "in", "break_end":
		return "working"
	case "break_start":
		return "on_break"
	}
	return "out"
}

// ShiftForPunch returns the shift in force now, or ErrNoShift. It also checks that the
// punch follows from today's previous one (in -> break/out, break_start -> break_end/out,
// out -> in) within the last 20 hours, so hours and attendance status cannot be corrupted by out-of-order punches.
func ShiftForPunch(ctx context.Context, repo Repository, tenantID, employeeID uuid.UUID, punchType string) (*Shift, error) {
	shift, err := repo.GetEmployeeShift(ctx, tenantID, employeeID, time.Now())
	if err != nil {
		return nil, err
	}
	if shift == nil || !ValidZone(shift.TimeZone) {
		return nil, ErrNoShift
	}
	last, err := repo.GetLastPunch(ctx, tenantID, employeeID)
	if err != nil {
		return nil, err
	}
	state := PunchState(last)
	allowed := map[string][]string{
		"out":      {"in"},
		"working":  {"out", "break_start"},
		"on_break": {"break_end", "out"},
	}[state]
	for _, t := range allowed {
		if t == punchType {
			return shift, nil
		}
	}
	return nil, fmt.Errorf("cannot record %q now: you are currently %s", punchType, map[string]string{
		"out": "checked out", "working": "checked in", "on_break": "on a break",
	}[state])
}
