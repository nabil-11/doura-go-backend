import "server-only";

import { matchLocalPlaces } from "@/lib/config/places";
import { cities } from "@/lib/config/site";
import type { LatLng } from "@/lib/domain/geo";

/**
 * Turning words into places, and places into words.
 *
 * This runs on the server rather than in the apps for one reason: the Google
 * key stays here. A key shipped inside a phone app can be pulled out of the
 * bundle and spent by anyone; this one never leaves the machine that pays for
 * it, and swapping providers is a change in one file.
 *
 *   Google   when GOOGLE_MAPS_API_KEY is set — far better place names and
 *            business listings in Tunisia, billed per request.
 *   Nominatim otherwise — OpenStreetMap's own geocoder: free, no key, and
 *            rate-limited, so results are cached and callers debounce.
 */

const NOMINATIM_URL = process.env.GEOCODER_URL ?? "https://nominatim.openstreetmap.org";
const TIMEOUT_MS = 4000;

function googleKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

export type Place = {
  /** What to show first: a name if it has one, otherwise the street. */
  label: string;
  /** The rest of the address, for the second line. */
  detail: string;
  point: LatLng;
};

// Searches repeat constantly as someone types, and the same few destinations
// come up all day, so a short memory saves most of the calls.
const cache = new Map<string, { value: unknown; at: number }>();
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 1000;

function remember<T>(key: string, value: T) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}

function recall<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_MS) return null;
  return hit.value as T;
}

/** Biases results towards where the service actually runs. */
const TUNIS = cities[0].center;

// ------------------------------------------------------------------ search ---

export async function searchPlaces(query: string, near: LatLng | null, language: string): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const key = `search:${language}:${trimmed.toLowerCase()}`;
  const hit = recall<Place[]>(key);
  if (hit) return hit;

  // The neighbourhoods people actually name go first, and they cost nothing.
  // A geocoder is built for addresses; "Lac 2" is not an address.
  const local = matchLocalPlaces(trimmed, near).map(
    (place): Place => ({ label: place.name, detail: place.area, point: { lat: place.lat, lng: place.lng } }),
  );

  const remote =
    (googleKey() ? await googleSearch(trimmed, near, language) : null) ?? (await nominatimSearch(trimmed, language));

  return remember(key, dedupe([...local, ...remote]).slice(0, 8));
}

/** Two providers naming one place is common; the first spelling wins. */
function dedupe(places: Place[]): Place[] {
  const kept: Place[] = [];
  for (const place of places) {
    const near = kept.some(
      (other) =>
        Math.abs(other.point.lat - place.point.lat) < 0.0015 &&
        Math.abs(other.point.lng - place.point.lng) < 0.0015,
    );
    if (!near) kept.push(place);
  }
  return kept;
}

type GooglePlacesResponse = {
  places?: {
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  }[];
};

/**
 * Text Search returns a name, an address and coordinates in one call, which is
 * exactly what the destination field needs — autocomplete would need a second
 * call per result just to find out where the place is.
 */
async function googleSearch(query: string, near: LatLng | null, language: string): Promise<Place[] | null> {
  const key = googleKey();
  if (!key) return null;
  const centre = near ?? TUNIS;

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // Asking for only these three keeps the request in the cheapest tier.
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: language,
        regionCode: "TN",
        maxResultCount: 6,
        locationBias: { circle: { center: { latitude: centre.lat, longitude: centre.lng }, radius: 30000 } },
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn("[places] google search failed", response.status);
      return null;
    }

    const body = (await response.json()) as GooglePlacesResponse;
    return (body.places ?? []).flatMap((place): Place[] => {
      if (!place.location) return [];
      const name = place.displayName?.text?.trim();
      const address = place.formattedAddress?.trim() ?? "";
      return [
        {
          label: name || address.split(",")[0] || address,
          detail: name ? address : address.split(",").slice(1).join(",").trim(),
          point: { lat: place.location.latitude, lng: place.location.longitude },
        },
      ];
    });
  } catch {
    return null;
  }
}

type NominatimResult = { display_name: string; lat: string; lon: string };

/**
 * Greater Tunis, as a box. Nominatim ranks what falls inside it first, which
 * is what stops "Avenue Habib Bourguiba" answering with Sfax's.
 */
const VIEWBOX = "9.90,37.02,10.50,36.55";

async function nominatimSearch(query: string, language: string): Promise<Place[]> {
  const rows = await nominatimQuery(query, language);
  // Nominatim matches the whole string or nothing, so a query that names a
  // neighbourhood it has never heard of comes back empty. Naming the city
  // gives it something it does know to anchor on.
  const fallback = rows.length === 0 ? await nominatimQuery(`${query}, Tunis`, language) : [];
  return [...rows, ...fallback].map((row) =>
    splitDisplayName(row.display_name, Number(row.lat), Number(row.lon)),
  );
}

async function nominatimQuery(query: string, language: string): Promise<NominatimResult[]> {
  const url = new URL("/search", NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "tn");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", language);
  // Bias, not a filter: `bounded=0` still returns a match further out rather
  // than nothing, which matters for a dropoff outside the service area.
  url.searchParams.set("viewbox", VIEWBOX);
  url.searchParams.set("bounded", "0");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "doura-go/1.0" },
      cache: "no-store",
    });
    if (!response.ok) return [];
    return (await response.json()) as NominatimResult[];
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------- reverse ---

/** What to call a dropped pin. Always returns something usable. */
export async function describePoint(point: LatLng, language: string): Promise<string> {
  const key = `reverse:${language}:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  const hit = recall<string>(key);
  if (hit) return hit;

  const label =
    (googleKey() ? await googleReverse(point, language) : null) ??
    (await nominatimReverse(point, language)) ??
    `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

  return remember(key, label);
}

type GoogleGeocodeResponse = { results?: { formatted_address?: string }[]; status?: string };

async function googleReverse(point: LatLng, language: string): Promise<string | null> {
  const key = googleKey();
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${point.lat},${point.lng}`);
  url.searchParams.set("language", language);
  url.searchParams.set("region", "tn");
  url.searchParams.set("key", key);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as GoogleGeocodeResponse;
    if (body.status !== "OK") return null;
    const address = body.results?.[0]?.formatted_address;
    return address ? address.split(",").slice(0, 2).join(", ") : null;
  } catch {
    return null;
  }
}

async function nominatimReverse(point: LatLng, language: string): Promise<string | null> {
  const url = new URL("/reverse", NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(point.lat));
  url.searchParams.set("lon", String(point.lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("accept-language", language);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "doura-go/1.0" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const row = (await response.json()) as { display_name?: string };
    return row.display_name ? splitDisplayName(row.display_name, point.lat, point.lng).label : null;
  } catch {
    return null;
  }
}

/** Nominatim returns one long comma-separated string; the first parts are the name. */
function splitDisplayName(displayName: string, lat: number, lng: number): Place {
  const parts = displayName.split(",").map((part) => part.trim());
  return {
    label: parts.slice(0, 2).join(", ") || displayName,
    detail: parts.slice(2, 5).join(", "),
    point: { lat, lng },
  };
}

/** Which provider is answering — surfaced on /api/v1/config so it's never a mystery. */
export function placesProvider(): "google" | "osm" {
  return googleKey() ? "google" : "osm";
}
