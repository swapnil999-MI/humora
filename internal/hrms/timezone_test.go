package hrms

import (
	"testing"
	"time"
)

func TestShiftClockAndDayUseTheShiftZone(t *testing.T) {
	ist := LoadZone("Asia/Kolkata")
	// 01:00 IST on 14 Oct is still 13 Oct in UTC; attendance must count it on the 14th.
	punch := time.Date(2026, 10, 13, 19, 30, 0, 0, time.UTC)
	if got := punch.In(ist).Format("2006-01-02"); got != "2026-10-14" {
		t.Fatalf("local day = %s, want 2026-10-14", got)
	}
	if got := DayStart(punch, ist); !got.Equal(time.Date(2026, 10, 13, 18, 30, 0, 0, time.UTC)) {
		t.Fatalf("DayStart = %s, want 18:30 UTC on the 13th", got.UTC())
	}

	// A 09:00 shift start in IST is 03:30 UTC.
	start, ok := ClockOn(time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC), "09:00", ist)
	if !ok || !start.Equal(time.Date(2026, 10, 14, 3, 30, 0, 0, time.UTC)) {
		t.Fatalf("ClockOn = %s (%v), want 03:30 UTC", start.UTC(), ok)
	}
}

func TestShiftTimeZoneValidation(t *testing.T) {
	if !ValidZone("Asia/Kolkata") || !ValidZone("America/New_York") {
		t.Fatal("real IANA zones must be accepted")
	}
	for _, bad := range []string{"", "Mars/Olympus", "Local"} {
		if ValidZone(bad) {
			t.Errorf("%q should be rejected", bad)
		}
	}
	if LoadZone("Mars/Olympus") != time.UTC {
		t.Error("unknown zones fall back to UTC")
	}

	// No guessed zone: a shift without a saved zone, or no shift at all, means UTC for
	// display and is refused for punching (see ShiftForPunch).
	if (*Shift)(nil).Location() != time.UTC || (&Shift{}).Location() != time.UTC {
		t.Error("missing zones must not be replaced by a default zone")
	}
}

func TestPunchStateFollowsRecentLastPunch(t *testing.T) {
	at := func(kind string, ago time.Duration) *AttendancePunch {
		return &AttendancePunch{PunchType: kind, PunchedAt: time.Now().Add(-ago)}
	}
	cases := []struct {
		last *AttendancePunch
		want string
	}{
		{nil, "out"},
		{at("in", 9*time.Hour), "working"}, // night shift past midnight: still checked in
		{at("break_start", time.Hour), "on_break"},
		{at("break_end", time.Hour), "working"},
		{at("out", time.Hour), "out"},
		{at("in", 21*time.Hour), "out"}, // forgotten check-out does not block tomorrow
	}
	for _, c := range cases {
		if got := PunchState(c.last); got != c.want {
			t.Errorf("PunchState(%v) = %s, want %s", c.last, got, c.want)
		}
	}
}
