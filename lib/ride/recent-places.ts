// Where the rider went last, kept in the browser.
//
// This is the only thing the web app writes to local storage, and deliberately
// so: the session is an httpOnly cookie, and a list of destinations is a
// convenience nobody can sign in with. Anything sensitive stays on the server.

import type { ChosenPoint } from "./api";

const KEY = "dg.recentPlaces";
const MAX = 6;

/** Two points this close together are the same doorway, not two destinations. */
const SAME_POINT = 0.0004;

function read(): ChosenPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ChosenPoint =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as ChosenPoint).address === "string" &&
        typeof (entry as ChosenPoint).lat === "number" &&
        typeof (entry as ChosenPoint).lng === "number",
    );
  } catch {
    // Private browsing, a full quota, or something else wrote nonsense here.
    return [];
  }
}

export function recentPlaces() {
  return read().slice(0, MAX);
}

/** Puts a place at the top, dropping any earlier entry for the same spot. */
export function rememberPlace(place: ChosenPoint) {
  const next = [
    place,
    ...read().filter(
      (entry) => Math.abs(entry.lat - place.lat) > SAME_POINT || Math.abs(entry.lng - place.lng) > SAME_POINT,
    ),
  ].slice(0, MAX);

  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not being able to remember a destination is not worth an error.
  }
  return next;
}

export function forgetPlaces() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}
