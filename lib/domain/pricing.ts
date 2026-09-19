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
