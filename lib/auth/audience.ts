// Who a mobile session belongs to. Riders and drivers use the same endpoints
// for shared resources (a ride has two sides), so the audience travels with the
// token and every handler states which side it serves.

export const MOBILE_AUDIENCES = ["rider", "driver"] as const;
export type MobileAudience = (typeof MOBILE_AUDIENCES)[number];

export function isMobileAudience(value: unknown): value is MobileAudience {
  return typeof value === "string" && (MOBILE_AUDIENCES as readonly string[]).includes(value);
}
