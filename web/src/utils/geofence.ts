export interface GeofenceConfig {
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isEnforced: boolean;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  updatedAt?: string;
}

// Fallback map center used until an office location is pinned in Company Settings.
export const DEFAULT_GEOFENCE_CONFIG: GeofenceConfig = {
  name: '',
  lat: 12.9716,
  lng: 77.5946,
  radiusMeters: 250,
  isEnforced: true,
};

const GEOFENCE_STORAGE_KEY = 'humora_geofence_config';

export function getActiveGeofenceConfig(): GeofenceConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_GEOFENCE_CONFIG;
  try {
    const raw = localStorage.getItem(GEOFENCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        return { ...DEFAULT_GEOFENCE_CONFIG, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored geofence config:', e);
  }
  return DEFAULT_GEOFENCE_CONFIG;
}

export function saveActiveGeofenceConfig(cfg: GeofenceConfig): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const enriched: GeofenceConfig = {
      ...cfg,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(enriched));
    // Dispatch custom storage event so other windows/tabs or active views update in real-time
    window.dispatchEvent(new Event('humora_geofence_updated'));
  } catch (e) {
    console.error('Failed to save geofence config:', e);
  }
}

export function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}
