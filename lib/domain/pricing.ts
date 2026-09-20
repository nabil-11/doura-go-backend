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
   * How much commission a driver may owe before their account stops taking
   * rides. Riders pay in cash, so the driver keeps the whole fare and the
   * commission builds up as a debt; this is the ceiling on that debt. Set it
   * to 0 to switch the limit off.
   */
  commissionCreditLimit: number;
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
  commissionCreditLimit: 150,
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
};

export function estimateFare(pricing: PricingValues, distanceKm: number, durationMin: number): FareBreakdown {
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
  };
}

// ------------------------------------------------- what a driver owes us ---

/**
 * Cash rides mean the driver is paid by the rider and owes Doura Go its
 * commission afterwards. That debt is tracked on the driver and settled at the
 * office; until it is, a driver over the limit cannot go back on the road.
 */
export type DriverBalance = {
  commissionDue: number;
  paidTotal: number;
  lastPaymentAt: Date | null;
};

export const EMPTY_BALANCE: DriverBalance = { commissionDue: 0, paidTotal: 0, lastPaymentAt: null };

/** Reads a stored balance, filling in anything a older document is missing. */
export function readBalance(balance: Partial<DriverBalance> | null | undefined): DriverBalance {
  return {
    commissionDue: round3(balance?.commissionDue ?? 0),
    paidTotal: round3(balance?.paidTotal ?? 0),
    lastPaymentAt: balance?.lastPaymentAt ?? null,
  };
}

/** How a payment can reach us. `adjustment` is a manual correction, not money. */
export const PAYMENT_CHANNELS = ["cash", "bank", "adjustment"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export function isOverCreditLimit(commissionDue: number, limit: number) {
  return limit > 0 && commissionDue >= limit;
}

/** 0–1, for the bar on the driver's page. Above the limit it reads full. */
export function creditUsage(commissionDue: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(1, Math.max(0, commissionDue / limit));
}

/** What is left before the account stops taking rides. */
export function creditRemaining(commissionDue: number, limit: number) {
  if (limit <= 0) return Infinity;
  return Math.max(0, round3(limit - commissionDue));
}
