export const RIDE_STATUSES = [
  "requested",
  "accepted",
  "arriving",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

/** Statuses that mean the ride is still happening. */
export const ONGOING_RIDE_STATUSES: readonly RideStatus[] = ["requested", "accepted", "arriving", "in_progress"];

export const PAYMENT_METHODS = ["cash", "card", "wallet"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * What a rider can actually choose today. Card and wallet exist in the data
 * model so historical rides keep their meaning, but no payment provider is
 * connected — add one before widening this list.
 */
export const ENABLED_PAYMENT_METHODS: readonly PaymentMethod[] = ["cash"];

export const CANCELLED_BY = ["rider", "driver", "system"] as const;
export type CancelledBy = (typeof CANCELLED_BY)[number];

export const RIDER_STATUSES = ["active", "blocked"] as const;
export type RiderStatus = (typeof RIDER_STATUSES)[number];

/** Filters exposed as tabs on the rides list. */
export const RIDE_FILTERS = ["all", "ongoing", "completed", "cancelled"] as const;
export type RideFilter = (typeof RIDE_FILTERS)[number];

/**
 * The ride as the driver app drives it forward. Every step is applied with the
 * expected previous status as a condition, so a replayed or out-of-order
 * request from a flaky mobile connection can never skip a step.
 */
export const RIDE_STEPS = {
  accept: { from: ["requested"], to: "accepted", stamp: "acceptedAt" },
  arrive: { from: ["accepted"], to: "arriving", stamp: null },
  start: { from: ["arriving", "accepted"], to: "in_progress", stamp: "startedAt" },
  complete: { from: ["in_progress"], to: "completed", stamp: "completedAt" },
} as const satisfies Record<
  string,
  { from: readonly RideStatus[]; to: RideStatus; stamp: "acceptedAt" | "startedAt" | "completedAt" | null }
>;

export type RideStep = keyof typeof RIDE_STEPS;

export function isRideStep(value: unknown): value is RideStep {
  return typeof value === "string" && value in RIDE_STEPS;
}

/** A rider can call the ride off until it has started. */
export const RIDER_CANCELLABLE: readonly RideStatus[] = ["requested", "accepted", "arriving"];

/** After these, a driver who backs out returns the ride to the pool. */
export const DRIVER_RELEASABLE: readonly RideStatus[] = ["accepted", "arriving"];

/** A cancellation fee applies once a driver is already on the way. */
export const FEE_BEARING_CANCELLATION: readonly RideStatus[] = ["accepted", "arriving"];

/** Reasons the platform itself cancels a ride. */
export const SYSTEM_CANCELLATIONS = { noDriverFound: "no_driver_found" } as const;

// Unambiguous alphabet: no O/0, I/1, or similar-looking pairs, so a code read
// over the phone or from a screenshot can't be mistyped.
const CODE_ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ2345679";

/** Short reference shown to riders and drivers, e.g. "DG-7F3K2Q". */
export function rideCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `DG-${code}`;
}

/**
 * The two handovers: the rider proves who they are when the ride starts, and
 * agrees it is over when it ends.
 *
 * Only the rider ever sees these. The driver has to be told them — read out,
 * or scanned off the rider's screen — which is what makes them evidence that
 * the two people were actually together. Without them a driver can start a
 * ride from anywhere and close it whenever, and on cash fares that is the
 * whole game.
 */
export const HANDOVERS = ["start", "finish"] as const;
export type Handover = (typeof HANDOVERS)[number];

/** Which handover a step needs, if any. */
export const STEP_HANDOVER: Partial<Record<RideStep, Handover>> = {
  start: "start",
  complete: "finish",
};

/** What a handover code looks like, for whoever is checking one. */
export const HANDOVER_CODE_PATTERN = /^\d{4}$/;

/** Four digits: short enough to read out over a running engine. */
export function handoverCode() {
  // Rejection-free and unbiased: 0000–9999 straight from four random digits.
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let code = "";
  for (const byte of bytes) code += String(byte % 10);
  return code;
}

/** How many wrong tries before a code is burned and has to be reissued. */
export const HANDOVER_ATTEMPTS = 5;

/**
 * What the rider's QR encodes. Kept to one short line so the code stays
 * low-density and scans from a cracked phone in daylight.
 */
export function handoverPayload(rideId: string, handover: Handover, code: string) {
  return `DG1:${rideId}:${handover}:${code}`;
}

export function parseHandoverPayload(scanned: string) {
  const parts = scanned.trim().split(":");
  if (parts.length !== 4 || parts[0] !== "DG1") return null;
  const [, rideId, handover, code] = parts;
  if (!HANDOVERS.includes(handover as Handover)) return null;
  if (!HANDOVER_CODE_PATTERN.test(code)) return null;
  return { rideId, handover: handover as Handover, code };
}
