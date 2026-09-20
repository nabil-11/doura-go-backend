// Geography helpers. Coordinates are always [longitude, latitude] when stored
// (GeoJSON) and { lat, lng } when they cross the API — the two orders are the
// most common source of bugs, so the conversion happens in one place.

export type LatLng = { lat: number; lng: number };

export const EARTH_RADIUS_KM = 6371;

export function toGeoPoint(point: LatLng) {
  return { type: "Point" as const, coordinates: [point.lng, point.lat] as [number, number] };
}

export function fromGeoPoint(point: { coordinates: [number, number] } | null | undefined): LatLng | null {
  if (!point?.coordinates) return null;
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Whether a point falls inside a polygon, by ray casting: count the edges a ray
 * heading east crosses, and an odd count means inside.
 *
 * A service area is a shape, not a circle. Greater Tunis runs from Raoued down
 * to Hammam Lif and out to Manouba, and no disc covers that without also
 * covering half the Gulf — so the boundary is drawn, and tested here. At city
 * scale the earth is flat enough to treat lat/lng as plain coordinates.
 */
export function pointInPolygon(point: LatLng, polygon: readonly LatLng[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    // Does this edge straddle the ray's latitude? One end strictly above and
    // one not, so a vertex on the line is counted once rather than twice.
    if (a.lat > point.lat === b.lat > point.lat) continue;
    const crossingLng = a.lng + ((point.lat - a.lat) / (b.lat - a.lat)) * (b.lng - a.lng);
    if (point.lng < crossingLng) inside = !inside;
  }
  return inside;
}

/**
 * Streets are longer than straight lines: a detour factor turns the great-circle
 * distance into a usable road estimate. 1.3–1.4 is the usual range for a dense
 * city grid.
 */
export const ROAD_FACTOR = 1.35;

/** Average door-to-door speed of a motorbike in Tunis traffic, km/h. */
export const AVERAGE_SPEED_KMH = 24;

export type RouteEstimate = { distanceKm: number; durationMin: number };

/**
 * Distance and duration between two points.
 *
 * This is a deliberate placeholder: it needs no API key, no network call and no
 * quota, which is what a pre-launch product wants. Swap the body for a routing
 * provider (Google Directions, Mapbox, OSRM) when real ETAs matter — every
 * caller goes through this function, so nothing else changes.
 */
export function estimateRoute(pickup: LatLng, dropoff: LatLng): RouteEstimate {
  const distanceKm = Math.round(haversineKm(pickup, dropoff) * ROAD_FACTOR * 100) / 100;
  const durationMin = Math.max(1, Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60));
  return { distanceKm, durationMin };
}

/** Rough time for a driver to reach a pickup point, in minutes. */
export function etaMinutes(distanceKm: number) {
  return Math.max(1, Math.round((distanceKm * ROAD_FACTOR) / AVERAGE_SPEED_KMH * 60));
}

export function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}
