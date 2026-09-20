// Fare calculation. The same function prices real rides (future mobile API)
// and powers the live preview on the pricing page.

export type PricingValues = {
  currency: string;
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  bookingFee: number;
  /** Platform commission in percent (0–100) */
  commissionRate: number;
  cancellationFee: number;
  /**
   * Rides no longer than this are charged one fixed price instead of being
   * metered. Set it to 0 to meter every ride.
   */
  shortRideKm: number;
  /** What a short ride costs, all in — no booking fee on top. */
  shortRideFare: number;
  /**
   * How much fare money a driver may be holding before their account stops
   * taking rides.
   *
   * Riders pay cash into the driver's pocket, so between settlements the
   * driver is carrying the platform's money. The ceiling is on that cash —
   * the whole fare, not the commission slice of it — because that is the
   * exposure: a driver holding 150 owes far less than 150, but 150 is what
   * has gone uncounted. Settling clears the cycle. Set to 0 to switch off.
   */
  cashLimit: number;
  /**
   * Whether the driver must be given the rider's code to start and to finish.
   *
   * On by default: it is what ties a ride to the two people who took it. The
   * switch exists because it is enforced on phones that update on their own
   * schedule — if a build goes out that cannot ask for a code, this turns the
   * requirement off from the backoffice rather than by a deploy.
   */
  requireHandover: boolean;
};

/** Starting values — tune them from the backoffice. Amounts in TND. */
export const DEFAULT_PRICING: PricingValues = {
  currency: "TND",
  baseFare: 1,
  perKm: 0.45,
  perMinute: 0.05,
  minimumFare: 2.5,
  bookingFee: 0.2,
  commissionRate: 15,
  cancellationFee: 1,
  shortRideKm: 2,
  shortRideFare: 2.5,
  cashLimit: 150,
  requireHandover: true,
};

/** Fares are rounded up to this step (0.100 TND = 100 millimes). */
export const FARE_ROUNDING_STEP = 0.1;

function roundUp(value: number, step: number) {
  // Work in integer thousandths to avoid floating point drift.
  const scaled = Math.round(value * 1000);
  const stepScaled = Math.round(step * 1000);
  return (Math.ceil(scaled / stepScaled) * stepScaled) / 1000;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export type FareBreakdown = {
  base: number;
  distance: number;
  time: number;
  bookingFee: number;
  total: number;
  commission: number;
  driverEarnings: number;
  currency: string;
  /** True when the short-ride price was charged instead of the meter. */
  flat?: boolean;
};

export function estimateFare(pricing: PricingValues, distanceKm: number, durationMin: number): FareBreakdown {
  // A hop across the neighbourhood is priced as one number, not as a sum a
  // rider has to work out. It is the whole fare: no booking fee on top, and no
  // minimum to apply, because it already is the minimum.
  if (pricing.shortRideKm > 0 && Math.max(0, distanceKm) <= pricing.shortRideKm) {
    const total = roundUp(pricing.shortRideFare, FARE_ROUNDING_STEP);
    const commission = round3((total * pricing.commissionRate) / 100);
    return {
      base: total,
      distance: 0,
      time: 0,
      bookingFee: 0,
      total,
      commission,
      driverEarnings: round3(total - commission),
      currency: pricing.currency,
      flat: true,
    };
  }

  const base = pricing.baseFare;
  const distance = round3(Math.max(0, distanceKm) * pricing.perKm);
  const time = round3(Math.max(0, durationMin) * pricing.perMinute);
  const trip = Math.max(pricing.minimumFare, base + distance + time);
  const total = roundUp(trip + pricing.bookingFee, FARE_ROUNDING_STEP);
  const commission = round3((total * pricing.commissionRate) / 100);
  return {
    base,
    distance,
    time,
    bookingFee: pricing.bookingFee,
    total,
    commission,
    driverEarnings: round3(total - commission),
    currency: pricing.currency,
    flat: false,
  };
}

// ------------------------------------------------- what a driver owes us ---

/**
 * Cash rides mean the rider pays the driver directly, so two numbers run
 * alongside each other between settlements:
 *
 *   cashCollected  the whole of every fare taken in cash — the platform's
 *                  money, sitting in the driver's pocket. This is what the
 *                  limit watches, because it is the exposure.
 *   commissionDue  Doura Go's share of that cash — what the driver actually
 *                  hands over to settle and get back on the road.
 *
 * A driver holding 150 owes roughly 22; they are blocked on the 150 and pay
 * the 22. Settling clears both, because the cycle starts again.
 */
export type DriverBalance = {
  cashCollected: number;
  commissionDue: number;
  paidTotal: number;
  lastPaymentAt: Date | null;
};

export const EMPTY_BALANCE: DriverBalance = {
  cashCollected: 0,
  commissionDue: 0,
  paidTotal: 0,
  lastPaymentAt: null,
};

/** Reads a stored balance, filling in anything an older document is missing. */
export function readBalance(balance: Partial<DriverBalance> | null | undefined): DriverBalance {
  return {
    cashCollected: round3(balance?.cashCollected ?? 0),
    commissionDue: round3(balance?.commissionDue ?? 0),
    paidTotal: round3(balance?.paidTotal ?? 0),
    lastPaymentAt: balance?.lastPaymentAt ?? null,
  };
}

/** How a payment can reach us. `adjustment` is a manual correction, not money. */
export const PAYMENT_CHANNELS = ["cash", "bank", "adjustment"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

/**
 * Whether the cash a driver is holding has reached the ceiling.
 *
 * Owing nothing is also a way out: the block exists to make a driver come in
 * and settle, and there is no settling a debt of zero. Without this an account
 * whose two figures had drifted apart — old data, a rate of 0 — would be
 * stopped with no action able to restart it.
 */
export function isOverCashLimit(
  balance: Pick<DriverBalance, "cashCollected" | "commissionDue">,
  limit: number,
) {
  return limit > 0 && balance.cashCollected >= limit && balance.commissionDue > 0;
}

/** 0–1, for the bar on the driver's page. Above the limit it reads full. */
export function cashUsage(cashCollected: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(1, Math.max(0, cashCollected / limit));
}

/** How much more a driver may take before the account stops. */
export function cashRemaining(cashCollected: number, limit: number) {
  if (limit <= 0) return Infinity;
  return Math.max(0, round3(limit - cashCollected));
}
