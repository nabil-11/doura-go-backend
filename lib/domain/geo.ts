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
