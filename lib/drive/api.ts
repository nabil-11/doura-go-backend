// The driver web app's window onto /api/v1.
//
// Everything here is same-origin and rides on the httpOnly session cookie, so
// the browser never holds a token: there is nothing to store, nothing to
// refresh and nothing an injected script could read back. That is also why no
// call sets an Authorization header — adding one would be the bug, not the
// feature.
//
// Every request carries the space header. One origin serves both web apps, and
// a browser signed into each would otherwise leave `GET /me` guessing which
// account it was being asked about. It is set here, in the one place every
// call goes through, so it cannot be forgotten.
//
// The shapes below mirror what the handlers actually return (see
// `lib/services/driver-app.ts`, `lib/services/ride-flow.ts` and `docs/api.md`).
// They are hand-written rather than inferred because the server types are
// `server-only`.

import { SPACE_HEADER } from "@/lib/auth/web-session";
import type { RideStatus } from "@/lib/domain/ride";

export type LatLng = { lat: number; lng: number };

export type Stop = { address: string; lat: number | null; lng: number | null };

export type Fare = {
  base: number;
  distance: number;
  time: number;
  bookingFee: number;
  total: number;
  /** Doura Go's share of the fare. On cash rides it is what the driver owes. */
  commission: number;
  /** What the driver keeps. */
  driverEarnings: number;
  currency: string;
  /** True when the short-ride price was charged instead of the meter. */
  flat?: boolean;
};

export type RideRider = {
  id: string;
  name: string;
  rating: number;
  /** Only while the ride is live. */
  phone?: string;
};

export type Ride = {
  id: string;
  code: string;
  status: RideStatus;
  city: string;
  pickup: Stop;
  dropoff: Stop;
  distanceKm: number;
  durationMin: number;
  /** The streets this ride follows, in order. Empty if routing was unavailable. */
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
  rider: RideRider | null;
};

export type DriverBalance = {
  /** Fares taken in cash and not yet settled — what the limit watches. */
  cashCollected: number;
  /** Doura Go's share of that cash: what you hand over to clear it. */
  commissionDue: number;
  paidTotal: number;
  lastPaymentAt: string | null;
  limit: number;
  blocked: boolean;
  remaining: number;
  currency: string;
};

export type DriverProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  city: string;
  status: "pending" | "active" | "suspended" | "rejected";
  availability: "offline" | "online" | "on_trip";
  photoUrl: string | null;
  rating: { average: number; count: number };
  stats: { completedRides: number; earnings: number };
  vehicle: {
    type: string | null;
    brand: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
    plateNumber: string | null;
  };
  license: { number: string | null; expiresAt: string | null };
  location: LatLng | null;
  lastSeenAt: string | null;
  balance: DriverBalance;
  onboarding: {
    ready: boolean;
    documents: boolean;
    license: boolean;
    vehicle: boolean;
    missingDocuments: string[];
    reviewReason: string | null;
  };
};

export type Offer = {
  id: string;
  code: string;
  pickup: Stop;
  dropoff: Stop;
  distanceKm: number;
  durationMin: number;
  earnings: number;
  total: number;
  currency: string;
  paymentMethod: string;
  /** How far the driver is from the pickup, as the crow flies. */
  pickupDistanceKm: number | null;
  expiresAt: string | null;
  requestedAt: string;
};

export type Earnings = {
  currency: string;
  today: { rides: number; earnings: number };
  last7Days: { rides: number; earnings: number };
  allTime: { rides: number; earnings: number };
};

/**
 * A failure with the code the API contract names. Screens switch on `code` and
 * show their own translated wording; the English `message` is for the console.
 */
export class DriveApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(code: string, status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "DriveApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Options = { body?: unknown; signal?: AbortSignal };

async function call<T>(method: string, path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { [SPACE_HEADER]: "driver" };
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      // The session is a cookie the browser holds; a relative URL and
      // same-origin credentials are the whole of the authentication story.
      credentials: "same-origin",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    // An aborted request is the caller changing its mind, not a failure.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new DriveApiError("network", 0, "The server could not be reached.");
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
    throw new DriveApiError(
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
    body: { phone, audience: "driver" },
  });
}

/** Verifies the code and sets the driver session cookie. */
export function verifyCode(phone: string, code: string) {
  return call<{ account: { id: string } }>("POST", "/auth/web/driver", { body: { phone, code } });
}

/** Drops the cookie. Nothing else to clear — it was the whole session. */
export function signOut() {
  return call<{ ok: boolean }>("DELETE", "/auth/web/driver");
}

// ---------------------------------------------------------------- account ---

export function getProfile(signal?: AbortSignal) {
  return call<{ audience: "driver"; driver: DriverProfile }>("GET", "/me", { signal });
}

export function updateProfile(input: { email: string | null }) {
  return call<{ driver: DriverProfile }>("PATCH", "/me", { body: input });
}

// ------------------------------------------------------------ on the road ---

export function setAvailability(availability: "online" | "offline", location?: LatLng) {
  return call<{ driver: DriverProfile }>("POST", "/driver/availability", {
    body: { availability, ...(location ? { location } : {}) },
  });
}

export function sendLocation(point: LatLng) {
  return call<{ at: string; nextWithinSeconds: number }>("POST", "/driver/location", { body: point });
}

export function getOffers(signal?: AbortSignal) {
  return call<{ offers: Offer[]; availability: string; offerSeconds: number }>("GET", "/driver/offers", { signal });
}

export function getEarnings(signal?: AbortSignal) {
  return call<{ earnings: Earnings }>("GET", "/driver/earnings", { signal });
}

// ------------------------------------------------------------------ rides ---

export function getActiveRide(signal?: AbortSignal) {
  return call<{ ride: Ride | null }>("GET", "/rides/active", { signal });
}

export function getRide(id: string, signal?: AbortSignal) {
  return call<{ ride: Ride }>("GET", `/rides/${id}`, { signal });
}

export function acceptRide(id: string) {
  return call<{ ride: Ride }>("POST", `/rides/${id}/accept`, { body: {} });
}

export function declineRide(id: string) {
  return call<{ declined: boolean }>("POST", `/rides/${id}/decline`, { body: {} });
}

export function arriveAtPickup(id: string) {
  return call<{ ride: Ride }>("POST", `/rides/${id}/arrive`, { body: {} });
}

/**
 * Both ends of the ride take the rider's four digits — scanned off their QR or
 * read out and typed in. Arriving at the pickup needs none: the driver is the
 * only one who knows they are there.
 */
export function startRide(id: string, code: string) {
  return call<{ ride: Ride }>("POST", `/rides/${id}/start`, { body: { code } });
}

export function completeRide(id: string, code: string) {
  return call<{ ride: Ride; fareChanged: boolean }>("POST", `/rides/${id}/complete`, { body: { code } });
}

/** Handing the ride back: it goes out to the other drivers again. */
export function releaseRide(id: string) {
  return call<{ ride: Ride; released: boolean }>("POST", `/rides/${id}/cancel`, { body: {} });
}

// -------------------------------------------------------------------- geo ---

/**
 * The streets to wherever the driver is headed. Asked of our own server rather
 * than a routing provider, so the key stays server-side and the answers come
 * out of the same cache the rest of the app uses.
 */
export function routeBetween(from: LatLng, to: LatLng, signal?: AbortSignal) {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
  });
  return call<{ route: LatLng[]; distanceKm: number; durationMin: number }>("GET", `/geo/route?${params}`, { signal });
}
