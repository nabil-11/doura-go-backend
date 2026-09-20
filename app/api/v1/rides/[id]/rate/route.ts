import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, readJson, requireRider } from "@/lib/api/route";
import { partiesFor, rateRide, toRideResource } from "@/lib/services/ride-flow";
import { rateSchema } from "@/lib/validation/api";

/**
 * One to five stars for a finished ride, once. The score folds into the
 * driver's running average in a single atomic update.
 */
export const POST = apiRoute(async (request: NextRequest, context: RouteContext<"/api/v1/rides/[id]/rate">) => {
  const { id: riderId } = await requireRider(request);
  const { id } = await context.params;
  const body = await readJson(request, rateSchema);

  const ride = await rateRide(riderId, id, body.rating);
  const parties = await partiesFor([ride]);
  return json({ ride: toRideResource(ride, parties.get(String(ride._id)), "rider") });
});
