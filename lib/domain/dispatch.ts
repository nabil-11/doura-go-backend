// How a ride request finds a driver. Tunables live here so the behaviour can be
// reasoned about (and later moved to the backoffice) without reading the query.

export const DISPATCH = {
  /** How far from the pickup point to look for a driver, in kilometres. */
  radiusKm: 6,
  /** How many drivers see the same request at once — first to accept wins. */
  candidates: 5,
  /** How long an offer stays on a driver's screen before the next round. */
  offerSeconds: 30,
  /** After this many rounds with nobody accepting, the ride is called off. */
  maxRounds: 4,
  /**
   * A driver counts as reachable only if their app reported a position within
   * this window — "online" alone is not enough after an app is killed.
   */
  heartbeatSeconds: 120,
} as const;

/** Total time a rider can wait before the platform gives up, in seconds. */
export const MAX_SEARCH_SECONDS = DISPATCH.offerSeconds * DISPATCH.maxRounds;

export function offerExpiry(from: Date = new Date()) {
  return new Date(from.getTime() + DISPATCH.offerSeconds * 1000);
}

export function heartbeatCutoff(from: Date = new Date()) {
  return new Date(from.getTime() - DISPATCH.heartbeatSeconds * 1000);
}
