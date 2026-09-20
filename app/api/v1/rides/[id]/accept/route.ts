import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, requireDriver } from "@/lib/api/route";
import { acceptRide, partiesFor, toRideResource } from "@/lib/services/ride-flow";

/**
 * Takes an offered ride. Several drivers see the same request, so this is a
 * race by design: exactly one wins, and the others get `offerExpired` — which
 * the app shows as "someone else took it", not as an error.
 */
export const POST = apiRoute(async (request: NextRequest, context: RouteContext<"/api/v1/rides/[id]/accept">) => {
  const { driver } = await requireDriver(request, { approved: true });
  const { id } = await context.params;

  const ride = await acceptRide(driver, id);
  const parties = await partiesFor([ride]);
  return json({ ride: toRideResource(ride, parties.get(String(ride._id)), "driver") });
});
