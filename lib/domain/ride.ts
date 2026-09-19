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

export const CANCELLED_BY = ["rider", "driver", "system"] as const;
export type CancelledBy = (typeof CANCELLED_BY)[number];

export const RIDER_STATUSES = ["active", "blocked"] as const;
export type RiderStatus = (typeof RIDER_STATUSES)[number];

/** Filters exposed as tabs on the rides list. */
export const RIDE_FILTERS = ["all", "ongoing", "completed", "cancelled"] as const;
export type RideFilter = (typeof RIDE_FILTERS)[number];
