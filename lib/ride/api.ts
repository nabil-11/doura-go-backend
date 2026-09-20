// The rider web app's window onto /api/v1.
//
// Everything here is same-origin and rides on the httpOnly session cookie, so
// the browser never holds a token: there is nothing to store, nothing to
// refresh and nothing an injected script could read back. That is also why no
// call sets an Authorization header — adding one would be the bug, not the
// feature.
//
// The shapes below mirror what the handlers actually return (see
// `lib/services/ride-flow.ts` and `docs/api.md`). They are hand-written rather
// than inferred because the server types are `server-only`.

import type { RideStatus } from "@/lib/domain/ride";

export type LatLng = { lat: number; lng: number };

export type Place = {
  /** What to show first: a name if it has one, otherwise the street. */
  label: string;
  /** The rest of the address, for the second line. */
  detail: string;
  point: LatLng;
};

/** A point the rider has chosen, with something readable to call it. */
export type ChosenPoint = { address: string; lat: number; lng: number };

export type Fare = {
  base: number;
  distance: number;
  time: number;
  bookingFee: number;
  total: number;
  currency: string;
  /** True when the short-ride price applied instead of the meter. */
  flat?: boolean;
};

export type RideEstimate = {
  city: string;
  distanceKm: number;
  durationMin: number;
  fare: Fare;
  cancellationFee: number;
  route: LatLng[];
  routeSource: "google" | "osrm" | "estimate";
};

export type HandoverHalf = { code: string; qr: string } | null;

export type RideDriver = {
  id: string;
  firstName: string;
  photoUrl: string | null;
  rating: number;
  vehicle: {
    type: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    plateNumber: string | null;
  };
  /** Only while the ride is live. */
  phone?: string;
  location?: LatLng | null;
  lastSeenAt?: string | null;
};

export type Ride = {
  id: string;
  code: string;
  status: RideStatus;
  city: string;
  pickup: { address: string; lat: number | null; lng: number | null };
  dropoff: { address: string; lat: number | null; lng: number | null };
  distanceKm: number;
  durationMin: number;
  route: LatLng[];
  fare: Fare;
  paymentMethod: string;
  cancellationFee: number | null;
  requestedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: "rider" | "driver" | "system" | null;
  cancellationReason: string | null;
  riderRating: number | null;
  handover: { start: HandoverHalf; finish: HandoverHalf } | null;
  driver: RideDriver | null;
  search: { round: number; maxRounds: number; expiresAt: string | null } | null;
};

export type RiderProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  rating: { average: number; count: number };
  stats: { completedRides: number };
};

export type AppConfig = {
  currency: string;
  /** The tariff the website shows; `cancellationFee` is what a rider is warned about. */
  pricing: { cancellationFee: number; shortRideKm: number; shortRideFare: number };
  search: { radiusKm: number; offerSeconds: number; maxSeconds: number };
  cities: {
    id: string;
    name: Record<string, string>;
    center: LatLng;
    radiusKm: number;
    bookable: boolean;
  }[];
};

/**
 * A failure with the code the API contract names. Screens switch on `code` and
 * show their own translated wording; the English `message` is for the console.
 */
export class RideApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(code: string, status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "RideApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Options = { body?: unknown; signal?: AbortSignal };

async function call<T>(method: string, path: string, options: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      // The session is a cookie the browser holds; a relative URL and
      // same-origin credentials are the whole of the authentication story.
      credentials: "same-origin",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    // An aborted request is the caller changing its mind, not a failure.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new RideApiError("network", 0, "The server could not be reached.");
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: Record<string, string> } } | null)
      ?.error;
    throw new RideApiError(
      error?.code ?? "generic",
      response.status,
      error?.message ?? "Request failed.",
      error?.details,
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------- sign-in ---

/** Sends the six-digit code. `debugCode` only ever appears off production. */
export function requestCode(phone: string) {
  return call<{ sent: boolean; expiresAt: string; debugCode?: string }>("POST", "/auth/otp", {
    body: { phone, audience: "rider" },
  });
}

/**
 * Verifies the code and sets the session cookie. A rider who has never ridden
 * gets `422 nameRequired`; sending the same code again with a name creates the
 * account.
 */
export function verifyCode(phone: string, code: string, name?: string) {
  return call<{ account: { id: string; isNew: boolean } }>("POST", "/auth/web", {
    body: { phone, code, ...(name ? { name } : {}) },
  });
}

/** Drops the cookie. Nothing else to clear — it was the whole session. */
export function signOut() {
  return call<{ ok: boolean }>("DELETE", "/auth/web");
}

// ---------------------------------------------------------------- account ---

export function getConfig() {
  return call<AppConfig>("GET", "/config");
}

export function getProfile() {
  return call<{ audience: "rider"; rider: RiderProfile }>("GET", "/me");
}

// -------------------------------------------------------------------- geo ---

export function searchPlaces(query: string, near: LatLng | null, lang: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query, lang });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lng", String(near.lng));
  }
  return call<{ places: Place[] }>("GET", `/geo/search?${params}`, { signal });
}

export function describePoint(point: LatLng, lang: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng), lang });
  return call<{ address: string }>("GET", `/geo/reverse?${params}`, { signal });
}

// ------------------------------------------------------------------ rides ---

export function estimateRide(pickup: LatLng, dropoff: LatLng, signal?: AbortSignal) {
  return call<{ estimate: RideEstimate }>("POST", "/rides/estimate", {
    body: { pickup: { lat: pickup.lat, lng: pickup.lng }, dropoff: { lat: dropoff.lat, lng: dropoff.lng } },
    signal,
  });
}

export function requestRide(pickup: ChosenPoint, dropoff: ChosenPoint) {
  return call<{ ride: Ride }>("POST", "/rides", { body: { pickup, dropoff, paymentMethod: "cash" } });
}

export function getActiveRide(signal?: AbortSignal) {
  return call<{ ride: Ride | null }>("GET", "/rides/active", { signal });
}

/** Polling this is also what moves the search on to the next round of drivers. */
export function getRide(id: string, signal?: AbortSignal) {
  return call<{ ride: Ride }>("GET", `/rides/${id}`, { signal });
}

export function cancelRide(id: string) {
  return call<{ ride: Ride; fee: number | null }>("POST", `/rides/${id}/cancel`, { body: {} });
}

export function rateRide(id: string, rating: number) {
  return call<{ ride: Ride }>("POST", `/rides/${id}/rate`, { body: { rating } });
}
