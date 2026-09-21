package hrms

import (
	"time"
)

// CalculateSandwichDays determines if intervening weekends or holidays count towards leave.
func CalculateSandwichDays(fromDate, toDate time.Time, holidays []time.Time, isSandwichRuleEnabled bool) (workingDays float64, sandwichDays float64) {
	if fromDate.After(toDate) {
		return 0, 0
	}

	holidayMap := make(map[string]bool)
	for _, h := range holidays {
		holidayMap[h.Format("2006-01-02")] = true
	}

	current := fromDate
	var rawWorkingDays float64
	var weekendOrHolidayCount float64

	for !current.After(toDate) {
		dateStr := current.Format("2006-01-02")
		weekday := current.Weekday()
		isWeekend := weekday == time.Saturday || weekday == time.Sunday
		isHoliday := holidayMap[dateStr]

		if isWeekend || isHoliday {
			weekendOrHolidayCount++
		} else {
			rawWorkingDays++
		}

		current = current.AddDate(0, 0, 1)
	}

	if !isSandwichRuleEnabled {
		return rawWorkingDays, 0
	}

	// If sandwich rule is enabled and the leave spans across weekends/holidays
	// with active working days on both ends:
	startWeekday := fromDate.Weekday()
	endWeekday := toDate.Weekday()

	startIsWork := startWeekday != time.Saturday && startWeekday != time.Sunday && !holidayMap[fromDate.Format("2006-01-02")]
	endIsWork := endWeekday != time.Saturday && endWeekday != time.Sunday && !holidayMap[toDate.Format("2006-01-02")]

	if startIsWork && endIsWork && weekendOrHolidayCount > 0 {
		sandwichDays = weekendOrHolidayCount
	}

	return rawWorkingDays, sandwichDays
}
