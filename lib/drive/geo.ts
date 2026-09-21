// Where the driver is, as the browser will tell us.
//
// The phone app has a native plugin and a permission dialog it controls; a
// browser has neither. `navigator.geolocation` is all there is, it only works
// on a secure origin, and the answer can be "no" in three different ways —
// each of which the driver has to fix differently, so each gets its own name.

export type LatLng = { lat: number; lng: number };

/** Place de Barcelone, Tunis: the map has to start somewhere. */
export const DEFAULT_CENTER: LatLng = { lat: 36.8065, lng: 10.1815 };

export type LocationProblem = "unsupported" | "denied" | "unavailable";

export class LocationDenied extends Error {
  readonly reason: LocationProblem;
  constructor(reason: LocationProblem) {
    super(`Location ${reason}`);
    this.name = "LocationDenied";
    this.reason = reason;
  }
}

/**
 * Accurate rather than quick: dispatch measures how far a driver is from a
 * pickup, and a cell-tower fix can be a kilometre out. The timeout is generous
 * for the same reason — a first GPS fix under a roof takes its time.
 */
const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 };

function problemOf(error: GeolocationPositionError): LocationProblem {
  return error.code === error.PERMISSION_DENIED ? "denied" : "unavailable";
}

function supported() {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function currentPosition(): Promise<LatLng> {
  if (!supported()) return Promise.reject(new LocationDenied("unsupported"));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new LocationDenied(problemOf(error))),
      OPTIONS,
    );
  });
}

/**
 * Follows the driver until the returned function is called. Errors are
 * swallowed on purpose: a watch that loses the signal in a tunnel should go
 * quiet and pick up again, not tear the screen down.
 */
export function watchPosition(onPoint: (point: LatLng) => void): () => void {
  if (!supported()) return () => undefined;
  const id = navigator.geolocation.watchPosition(
    (position) => onPoint({ lat: position.coords.latitude, lng: position.coords.longitude }),
    () => undefined,
    OPTIONS,
  );
  return () => navigator.geolocation.clearWatch(id);
}

const EARTH_RADIUS_M = 6_371_000;

/** Straight-line metres. Used to decide whether a new route is worth asking for. */
export function metresBetween(a: LatLng, b: LatLng) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
