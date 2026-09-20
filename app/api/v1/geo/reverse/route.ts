import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, authenticate, limit, readQuery } from "@/lib/api/route";
import { describePoint } from "@/lib/services/places";
import { reverseGeocodeSchema } from "@/lib/validation/api";

/**
 * What to call a point on the map. Used when a rider drops a pin and when the
 * app fills the pickup in from the phone's own position — a driver needs
 * something they can read, not a pair of coordinates.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const principal = await authenticate(request);
  const { lat, lng, lang } = readQuery(request, reverseGeocodeSchema);
  limit(`geo:reverse:${principal.id}`, 40, 60_000);

  return json({ address: await describePoint({ lat, lng }, lang) });
});
