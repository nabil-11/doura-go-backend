import "server-only";

import { estimateRoute, type LatLng } from "@/lib/domain/geo";

/**
 * Real routes, along real streets.
 *
 * A straight line between two points is never what a moto rides, and in Tunis —
 * one-way streets, the lake, the medina — it can be a long way off. This asks a
 * routing engine for the actual path, and the ride is priced on that.
 *
 * Two providers, chosen by what is configured:
 *
 *   Google   when GOOGLE_MAPS_API_KEY is set — traffic-aware, best data here,
 *            and billed per request.
 *   OSRM     otherwise — free, no key, the natural partner to the
 *            OpenStreetMap tiles the maps already use. The default is Google's
 *            public demo server, which has no guarantees: point ROUTING_URL at
 *            your own before the apps carry real traffic.
 *
 * Whichever is in use, a failure falls back to a straight-line estimate rather
 * than blocking a booking: a rider who can't be quoted can't ride.
 */

const OSRM_URL = process.env.ROUTING_URL ?? "https://router.project-osrm.org";
// A rider is waiting on this for a price, so the budget is short — but not so
// short that a cold function's first DNS and TLS handshake spends it all.
const TIMEOUT_MS = 6000;

function googleKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

export type RouteSource = "google" | "osrm" | "estimate";

export type Route = {
  distanceKm: number;
  durationMin: number;
  /** The path itself, in order. Empty when it had to be estimated. */
  geometry: LatLng[];
  /** How the numbers were arrived at — worth knowing when a fare is queried. */
  source: RouteSource;
};

type CacheEntry = { route: Route; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 5 * 60_000;
const CACHE_MAX = 500;

/** Rounded to ~10 m, so nudging a pin reuses the same answer. */
function cacheKey(from: LatLng, to: LatLng) {
  const round = (value: number) => value.toFixed(4);
  return `${round(from.lat)},${round(from.lng)};${round(to.lat)},${round(to.lng)}`;
}

export async function getRoute(from: LatLng, to: LatLng): Promise<Route> {
  const key = cacheKey(from, to);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.route;

  const route = (googleKey() ? await googleRoute(from, to) : null) ?? (await osrmRoute(from, to)) ?? fallback(from, to);

  if (cache.size >= CACHE_MAX) {
    // Cheap eviction: the oldest insertion goes first.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { route, at: Date.now() });
  return route;
}

// ------------------------------------------------------------------ google ---

type GoogleRoutesResponse = {
  routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[];
};

/**
 * The Routes API, asking for what a two-wheeler would do in current traffic.
 * `TWO_WHEELER` is supported in a growing list of countries and falls back to
 * driving where it isn't, which is close enough for a moto.
 */
async function googleRoute(from: LatLng, to: LatLng): Promise<Route | null> {
  const key = googleKey();
  if (!key) return null;

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: "TWO_WHEELER",
        routingPreference: "TRAFFIC_AWARE",
        polylineQuality: "HIGH_QUALITY",
        languageCode: "fr",
        regionCode: "TN",
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn("[routing] google routes failed", response.status);
      return null;
    }

    const body = (await response.json()) as GoogleRoutesResponse;
    const best = body.routes?.[0];
    if (!best?.distanceMeters) return null;

    const seconds = Number.parseInt(best.duration ?? "0", 10);
    return {
      distanceKm: Math.round((best.distanceMeters / 1000) * 100) / 100,
      durationMin: Math.max(1, Math.round(seconds / 60)),
      geometry: thin(decodePolyline(best.polyline?.encodedPolyline ?? "")),
      source: "google",
    };
  } catch {
    return null;
  }
}

/**
 * Google encodes a path as a string of deltas. The algorithm is fixed and
 * tiny, so it lives here rather than pulling in a package for thirty lines.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of ["lat", "lng"] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === "lat") lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// -------------------------------------------------------------------- osrm ---

type OsrmResponse = {
  code?: string;
  routes?: { distance: number; duration: number; geometry?: { coordinates: [number, number][] } }[];
};

async function osrmRoute(from: LatLng, to: LatLng): Promise<Route | null> {
  // OSRM wants longitude first. `full` is the geometry as routed: `simplified`
  // drops so much that consecutive points sit a kilometre apart, and the line
  // drawn through them cuts across blocks instead of following the street.
  // It is thinned back down on the way out, by shape rather than by budget.
  const url =
    `${OSRM_URL}/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "doura-go/1.0" },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as OsrmResponse;
    const best = body.routes?.[0];
    if (body.code !== "Ok" || !best) return null;

    return {
      distanceKm: Math.round((best.distance / 1000) * 100) / 100,
      durationMin: Math.max(1, Math.round(best.duration / 60)),
      geometry: thin((best.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng }))),
      source: "osrm",
    };
  } catch {
    // Timeout, DNS, a provider having a bad day — the estimate carries it.
    return null;
  }
}

// ------------------------------------------------------------------ shape ---

/** How far a dropped point may sit from the line kept in its place, in metres. */
const THIN_TOLERANCE_M = 6;

/** Degrees of latitude are the same length everywhere; longitude is not. */
const M_PER_DEG_LAT = 111_320;

/**
 * Douglas–Peucker: keep the points that carry the shape, drop the ones that sit
 * on a line between their neighbours.
 *
 * A routed path repeats itself — a straight avenue arrives as dozens of points
 * along one line — and every one of them is paid for twice, once in the ride
 * document and once over a phone's data connection. Thinning by *shape* rather
 * than by a point budget is what keeps the corners: at six metres the drawn
 * line still lies on the street at full zoom.
 */
function thin(points: LatLng[], toleranceM = THIN_TOLERANCE_M): LatLng[] {
  if (points.length <= 2) return points.map(round5);

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  // Iterative rather than recursive: a long route is thousands of points, and
  // the stack is not the place to find that out.
  const pending: [number, number][] = [[0, points.length - 1]];
  while (pending.length) {
    const [first, last] = pending.pop()!;
    let farthest = toleranceM;
    let at = -1;
    for (let i = first + 1; i < last; i += 1) {
      const distance = perpendicularM(points[i], points[first], points[last]);
      if (distance > farthest) {
        farthest = distance;
        at = i;
      }
    }
    if (at === -1) continue; // The whole span is within tolerance of its chord.
    keep[at] = 1;
    pending.push([first, at], [at, last]);
  }

  return points.filter((_, index) => keep[index]).map(round5);
}

/** Five decimals is about a metre — more than a map pixel ever shows. */
function round5(point: LatLng): LatLng {
  return { lat: Math.round(point.lat * 1e5) / 1e5, lng: Math.round(point.lng * 1e5) / 1e5 };
}

/** Distance from a point to the segment a–b, in metres. */
function perpendicularM(point: LatLng, a: LatLng, b: LatLng) {
  const mPerLng = M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
  const x = (point.lng - a.lng) * mPerLng;
  const y = (point.lat - a.lat) * M_PER_DEG_LAT;
  const bx = (b.lng - a.lng) * mPerLng;
  const by = (b.lat - a.lat) * M_PER_DEG_LAT;

  const length2 = bx * bx + by * by;
  if (length2 === 0) return Math.hypot(x, y);
  // Clamped, so a point past either end measures to that end rather than to
  // the infinite line running through them.
  const t = Math.max(0, Math.min(1, (x * bx + y * by) / length2));
  return Math.hypot(x - t * bx, y - t * by);
}

function fallback(from: LatLng, to: LatLng): Route {
  const { distanceKm, durationMin } = estimateRoute(from, to);
  return { distanceKm, durationMin, geometry: [], source: "estimate" };
}
