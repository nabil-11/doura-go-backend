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
const TIMEOUT_MS = 4000;

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
        polylineQuality: "OVERVIEW",
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
      geometry: decodePolyline(best.polyline?.encodedPolyline ?? ""),
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
  // OSRM wants longitude first. `simplified` keeps the path drawable without
  // carrying every kerb; `geojson` avoids decoding a polyline by hand.
  const url =
    `${OSRM_URL}/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=simplified&geometries=geojson&alternatives=false&steps=false`;

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
      geometry: (best.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })),
      source: "osrm",
    };
  } catch {
    // Timeout, DNS, a provider having a bad day — the estimate carries it.
    return null;
  }
}

function fallback(from: LatLng, to: LatLng): Route {
  const { distanceKm, durationMin } = estimateRoute(from, to);
  return { distanceKm, durationMin, geometry: [], source: "estimate" };
}
