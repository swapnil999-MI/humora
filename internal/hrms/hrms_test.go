package hrms

import (
	"math"
	"testing"
	"time"
)

func TestHaversineDistance(t *testing.T) {
	// Bangalore coordinates
	lat1, lon1 := 12.9715987, 77.5945627
	// Exactly same point -> distance must be 0
	distZero := HaversineDistance(lat1, lon1, lat1, lon1)
	if distZero > 0.001 {
		t.Errorf("expected 0 distance for identical coordinates, got %f", distZero)
	}

	// Near point ~111 meters North (approx 0.001 degree lat)
	lat2, lon2 := lat1+0.001, lon1
	distNorth := HaversineDistance(lat1, lon1, lat2, lon2)
	if math.Abs(distNorth-111.0) > 10.0 {
		t.Errorf("expected approx 111m distance, got %f", distNorth)
	}
}

func TestPointInPolygon_RayCasting(t *testing.T) {
	// Define a square polygon around office
	polygon := [][2]float64{
		{12.9700, 77.5900}, // SW
		{12.9700, 77.6000}, // SE
		{12.9800, 77.6000}, // NE
		{12.9800, 77.5900}, // NW
	}

	// Point inside polygon
	insideLat, insideLon := 12.9750, 77.5950
	if !PointInPolygon(insideLat, insideLon, polygon) {
		t.Errorf("expected coordinate (%f, %f) to be INSIDE polygon", insideLat, insideLon)
	}

	// Point outside polygon
	outsideLat, outsideLon := 12.9900, 77.5950
	if PointInPolygon(outsideLat, outsideLon, polygon) {
		t.Errorf("expected coordinate (%f, %f) to be OUTSIDE polygon", outsideLat, outsideLon)
	}
}

func TestVerifyGeofence_RadiusAndBSSID(t *testing.T) {
	office := &OfficeLocation{
		Name:             "Bangalore HQ",
		Latitude:         12.9715987,
		Longitude:        77.5945627,
		RadiusMeters:     150,
		AllowedWiFiBSSID: []string{"00:14:22:01:23:45"},
	}

	// Case 1: Within radius
	ok, msg := VerifyGeofence(office, 12.9716, 77.5946, "")
	if !ok {
		t.Errorf("expected punch within 150m radius to be verified, got msg: %s", msg)
	}

	// Case 2: Outside radius but matching corporate Wi-Fi BSSID
	ok, msg = VerifyGeofence(office, 13.0500, 77.7000, "00:14:22:01:23:45")
	if !ok {
		t.Errorf("expected punch matching Wi-Fi BSSID to be verified, got msg: %s", msg)
	}

	// Case 3: Outside radius and wrong Wi-Fi
	ok, _ = VerifyGeofence(office, 13.0500, 77.7000, "wrong:wifi:bssid")
	if ok {
		t.Errorf("expected punch outside boundary with invalid Wi-Fi to be rejected")
	}
}

func TestCalculateSandwichDays(t *testing.T) {
	// Friday to Monday:
	// 2026-10-02 (Friday)
	// 2026-10-03 (Saturday - Weekend)
	// 2026-10-04 (Sunday - Weekend)
	// 2026-10-05 (Monday)
	friday, _ := time.Parse("2006-01-02", "2026-10-02")
	monday, _ := time.Parse("2006-01-02", "2026-10-05")

	// 1. Sandwich Rule Enabled: Weekend days (Sat+Sun = 2) must be added
	workDays, sandwichDays := CalculateSandwichDays(friday, monday, nil, true)
	if workDays != 2 {
		t.Errorf("expected 2 working days (Fri + Mon), got %f", workDays)
	}
	if sandwichDays != 2 {
		t.Errorf("expected 2 sandwich days added (Sat + Sun), got %f", sandwichDays)
	}

	// 2. Sandwich Rule Disabled: Weekend days must NOT be added
	workDays, sandwichDays = CalculateSandwichDays(friday, monday, nil, false)
	if workDays != 2 {
		t.Errorf("expected 2 working days, got %f", workDays)
	}
	if sandwichDays != 0 {
		t.Errorf("expected 0 sandwich days added when rule is disabled, got %f", sandwichDays)
	}

	// 3. Mid-week holiday sandwich:
	// 2026-10-06 (Tuesday)
	// 2026-10-07 (Wednesday - Public Holiday)
	// 2026-10-08 (Thursday)
	tuesday, _ := time.Parse("2006-01-02", "2026-10-06")
	thursday, _ := time.Parse("2006-01-02", "2026-10-08")
	wedHoliday, _ := time.Parse("2006-01-02", "2026-10-07")

	workDays, sandwichDays = CalculateSandwichDays(tuesday, thursday, []time.Time{wedHoliday}, true)
	if workDays != 2 {
		t.Errorf("expected 2 working days (Tue + Thu), got %f", workDays)
	}
	if sandwichDays != 1 {
		t.Errorf("expected 1 sandwich day added for Wednesday holiday, got %f", sandwichDays)
	}
}
