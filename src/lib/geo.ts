/**
 * Geographic helpers: distance, ETA, point-in-region checks.
 * Uses the Haversine formula. No external map API required.
 * Map provider integrations (Google Maps, Mapbox, OSRM) can be
 * plugged in via the MapsService abstraction without changing
 * call sites.
 */

export type LatLng = { lat: number; lng: number }

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function estimateDurationMinutes(distanceKm: number, avgSpeedKmh = 28): number {
  return (distanceKm / Math.max(1, avgSpeedKmh)) * 60
}

/**
 * Mocked address search: returns a few preset locations around
 * Tehran for the demo. In production this calls the configured
 * maps provider's geocoding endpoint.
 */
const PRESET_LOCATIONS: { label: string; address: string; lat: number; lng: number }[] = [
  { label: 'Azadi Square', address: 'Azadi Square, Tehran', lat: 35.6997, lng: 51.3380 },
  { label: 'Valiasr St', address: 'Valiasr Street, Tehran', lat: 35.7008, lng: 51.3914 },
  { label: 'Tajrish Square', address: 'Tajrish Square, Tehran', lat: 35.8046, lng: 51.4339 },
  { label: 'Saadat Abad', address: 'Saadat Abad, Tehran', lat: 35.7750, lng: 51.3740 },
  { label: 'Mehrabad Airport', address: 'Mehrabad International Airport, Tehran', lat: 35.6892, lng: 51.3134 },
  { label: 'Imam Khomeini Sq', address: 'Imam Khomeini Square, Tehran', lat: 35.6848, lng: 51.3885 },
  { label: 'Enghelab Square', address: 'Enghelab Square, Tehran', lat: 35.7009, lng: 51.3925 },
  { label: 'Vanak Square', address: 'Vanak Square, Tehran', lat: 35.7574, lng: 51.4099 },
  { label: 'Pardis Tech', address: 'Pardis Technology Park, Tehran', lat: 35.7376, lng: 51.6680 },
]

export function searchAddresses(query: string): { label: string; address: string; lat: number; lng: number }[] {
  if (!query || query.trim().length < 2) return PRESET_LOCATIONS.slice(0, 5)
  const q = query.trim().toLowerCase()
  return PRESET_LOCATIONS.filter(
    (l) => l.label.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
  ).slice(0, 8)
}

export function reverseGeocode(lat: number, lng: number): string {
  // Mock reverse geocode: find nearest preset location
  let nearest = PRESET_LOCATIONS[0]
  let minDist = Infinity
  for (const loc of PRESET_LOCATIONS) {
    const d = haversineKm({ lat, lng }, { lat: loc.lat, lng: loc.lng })
    if (d < minDist) {
      minDist = d
      nearest = loc
    }
  }
  if (minDist < 0.3) return nearest.address
  return `Location near ${nearest.label} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
}

/**
 * Simulated route: draws a smooth polyline between two points using
 * intermediate interpolated points. Production would call a routing
 * API (OSRM, Mapbox, Google) for actual road-following polylines.
 */
export function simulateRoute(a: LatLng, b: LatLng, steps = 24): LatLng[] {
  const points: LatLng[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Add slight curvature to look more like a road
    const midLat = (a.lat + b.lat) / 2 + (Math.random() - 0.5) * 0.005
    const midLng = (a.lng + b.lng) / 2 + (Math.random() - 0.5) * 0.005
    const lat = (1 - t) * (1 - t) * a.lat + 2 * (1 - t) * t * midLat + t * t * b.lat
    const lng = (1 - t) * (1 - t) * a.lng + 2 * (1 - t) * t * midLng + t * t * b.lng
    points.push({ lat, lng })
  }
  return points
}

/**
 * Move a point toward destination by a fraction (0-1).
 * Used to animate driver approaching pickup / destination.
 */
export function interpolate(from: LatLng, to: LatLng, fraction: number): LatLng {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  }
}
