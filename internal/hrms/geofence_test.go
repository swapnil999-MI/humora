package hrms

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestVerifyGeofence_RadialDistance(t *testing.T) {
	// Bangalore Tech Park HQ
	office := &OfficeLocation{
		ID:           uuid.New(),
		TenantID:     uuid.New(),
		Name:         "Bangalore Tech Park HQ",
		Latitude:     12.9715987,
		Longitude:    77.5945627,
		RadiusMeters: 200,
	}

	// 1. Exactly at office coordinates -> inside
	inside, msg := VerifyGeofence(office, 12.9715987, 77.5945627, "")
	if !inside {
		t.Fatalf("expected inside geofence, got outside: %s", msg)
	}
	if !strings.Contains(msg, "verified by office geofence radius") {
		t.Errorf("unexpected message: %s", msg)
	}

	// 2. ~50m away -> inside
	inside, msg = VerifyGeofence(office, 12.9719000, 77.5945627, "")
	if !inside {
		t.Fatalf("expected inside geofence, got outside: %s", msg)
	}

	// 3. ~5km away (Electronic City to Indiranagar) -> outside
	inside, msg = VerifyGeofence(office, 12.9783692, 77.6408356, "")
	if inside {
		t.Fatalf("expected outside geofence, got inside: %s", msg)
	}
	if !strings.Contains(msg, "outside office geofenced boundary") {
		t.Errorf("unexpected message: %s", msg)
	}
}

func TestVerifyGeofence_WiFiBSSID(t *testing.T) {
	office := &OfficeLocation{
		ID:               uuid.New(),
		TenantID:         uuid.New(),
		Name:             "Bangalore Tech Park HQ",
		Latitude:         12.9715987,
		Longitude:        77.5945627,
		RadiusMeters:     200,
		AllowedWiFiBSSID: []string{"00:14:22:01:23:45", "c8:3a:35:12:34:56"},
	}

	// Far away, but connected to corporate Wi-Fi BSSID -> verified!
	inside, msg := VerifyGeofence(office, 13.5000000, 78.0000000, "00:14:22:01:23:45")
	if !inside {
		t.Fatalf("expected inside with corporate wifi, got false: %s", msg)
	}
	if !strings.Contains(msg, "verified by corporate Wi-Fi BSSID") {
		t.Errorf("unexpected message: %s", msg)
	}

	// Case-insensitive BSSID check
	inside, _ = VerifyGeofence(office, 13.5000000, 78.0000000, "C8:3A:35:12:34:56")
	if !inside {
		t.Fatalf("expected inside with case-insensitive BSSID")
	}

	// Unrecognized BSSID + outside radial perimeter -> rejected
	inside, msg = VerifyGeofence(office, 13.5000000, 78.0000000, "aa:bb:cc:dd:ee:ff")
	if inside {
		t.Fatalf("expected outside with unrecognized BSSID, got inside: %s", msg)
	}
	if !strings.Contains(msg, "outside office geofenced boundary") {
		t.Errorf("unexpected message: %s", msg)
	}
}
