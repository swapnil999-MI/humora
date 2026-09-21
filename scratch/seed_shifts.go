package main

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

func main() {
	db, err := sql.Open("postgres", "postgres://postgres:Paylogic2026@192.168.1.20:5432/paylogic_local?sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// 1. Check existing tenant
	var tenantID uuid.UUID
	err = db.QueryRow("SELECT id FROM tenants LIMIT 1").Scan(&tenantID)
	if err != nil {
		log.Fatal("failed to find tenant: ", err)
	}
	fmt.Printf("Tenant: %s\n", tenantID)

	// 2. Check existing shifts
	rows, err := db.Query("SELECT id, name, start_time, end_time, grace_minutes FROM hrms_shifts WHERE tenant_id = $1", tenantID)
	if err != nil {
		log.Fatal("failed to query shifts: ", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
		var id uuid.UUID
		var name, start, end string
		var grace int
		rows.Scan(&id, &name, &start, &end, &grace)
		fmt.Printf("Shift [%d]: %s (%s) %s - %s (Grace: %dm)\n", count, name, id, start, end, grace)
	}

	if count == 0 {
		fmt.Println("No shifts found! Seeding standard shifts...")
		shifts := []struct {
			name     string
			start    string
			end      string
			grace    int
			halfDay  float64
			fullDay  float64
			isNight  bool
			allowance float64
		}{
			{"General Day Shift", "09:00:00", "18:00:00", 15, 4.0, 8.0, false, 0.0},
			{"APAC Morning Shift", "07:00:00", "16:00:00", 15, 4.0, 8.0, false, 0.0},
			{"Flexible 8h Bandwidth", "10:00:00", "19:00:00", 30, 4.0, 8.0, false, 0.0},
		}

		for _, s := range shifts {
			shiftID := uuid.New()
			_, err := db.Exec(`
				INSERT INTO hrms_shifts (id, tenant_id, name, start_time, end_time, grace_minutes, half_day_hours, full_day_hours, is_night_shift, night_shift_allowance, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
			`, shiftID, tenantID, s.name, s.start, s.end, s.grace, s.halfDay, s.fullDay, s.isNight, s.allowance)
			if err != nil {
				log.Fatalf("failed to seed shift %s: %v", s.name, err)
			}
			fmt.Printf("Seeded shift: %s (%s)\n", s.name, shiftID)
		}
	}

	// 3. Ensure employee Alice Smith has an active roster entry
	var empID uuid.UUID
	err = db.QueryRow("SELECT id FROM hrms_employees WHERE tenant_id = $1 LIMIT 1", tenantID).Scan(&empID)
	if err == nil {
		var generalShiftID uuid.UUID
		_ = db.QueryRow("SELECT id FROM hrms_shifts WHERE tenant_id = $1 AND name = 'General Day Shift' LIMIT 1", tenantID).Scan(&generalShiftID)
		if generalShiftID != uuid.Nil {
			_, _ = db.Exec(`
				INSERT INTO hrms_shift_rosters (id, tenant_id, employee_id, shift_id, effective_date, created_at)
				VALUES ($1, $2, $3, $4, '2026-09-01', NOW())
				ON CONFLICT (employee_id, effective_date) DO NOTHING
			`, uuid.New(), tenantID, empID, generalShiftID)
			fmt.Printf("Assigned Alice Smith (%s) to General Day Shift (%s) effective 2026-09-01\n", empID, generalShiftID)
		}
	}
}
