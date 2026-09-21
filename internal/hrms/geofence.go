package hrms

import (
	"encoding/json"
	"math"
	"strings"
)

const earthRadiusMeters = 6371000.0

// HaversineDistance calculates the great-circle distance between two coordinates in meters.
func HaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	radLat1 := lat1 * math.Pi / 180.0
	radLat2 := lat2 * math.Pi / 180.0
	deltaLat := (lat2 - lat1) * math.Pi / 180.0
	deltaLon := (lon2 - lon1) * math.Pi / 180.0

	a := math.Sin(deltaLat/2.0)*math.Sin(deltaLat/2.0) +
		math.Cos(radLat1)*math.Cos(radLat2)*
			math.Sin(deltaLon/2.0)*math.Sin(deltaLon/2.0)

	c := 2.0 * math.Atan2(math.Sqrt(a), math.Sqrt(1.0-a))
	return earthRadiusMeters * c
}

// PointInPolygon checks if a coordinate is inside a polygon using ray-casting.
func PointInPolygon(lat, lon float64, polygon [][2]float64) bool {
	n := len(polygon)
	if n < 3 {
		return false
	}

	inside := false
	j := n - 1

	for i := 0; i < n; i++ {
		xi, yi := polygon[i][1], polygon[i][0] // lng, lat
		xj, yj := polygon[j][1], polygon[j][0]

		intersect := ((yi > lat) != (yj > lat)) &&
			(lon < (xj-xi)*(lat-yi)/(yj-yi)+xi)

		if intersect {
			inside = !inside
		}
		j = i
	}

	return inside
}

// VerifyGeofence validates if an employee is within office bounds.
func VerifyGeofence(office *OfficeLocation, lat, lon float64, wifiBSSID string) (bool, string) {
	if office == nil {
		return false, "office location not found"
	}

	// 1. Check Wi-Fi BSSID match if provided
	if wifiBSSID != "" && len(office.AllowedWiFiBSSID) > 0 {
		cleanBSSID := strings.ToLower(strings.TrimSpace(wifiBSSID))
		for _, bssid := range office.AllowedWiFiBSSID {
			if strings.ToLower(strings.TrimSpace(bssid)) == cleanBSSID {
				return true, "verified by corporate Wi-Fi BSSID"
			}
		}
	}

	// 2. Check Polygon Boundary if defined
	if office.PolygonCoordinates != nil && *office.PolygonCoordinates != "" {
		var polyCoords [][2]float64
		if err := json.Unmarshal([]byte(*office.PolygonCoordinates), &polyCoords); err == nil && len(polyCoords) >= 3 {
			if PointInPolygon(lat, lon, polyCoords) {
				return true, "verified by office geofence polygon"
			}
		}
	}

	// 3. Fallback to Haversine radial distance
	dist := HaversineDistance(office.Latitude, office.Longitude, lat, lon)
	if dist <= float64(office.RadiusMeters) {
		return true, "verified by office geofence radius"
	}

	return false, "outside office geofenced boundary"
}
