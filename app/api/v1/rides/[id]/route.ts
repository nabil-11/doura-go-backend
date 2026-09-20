import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, authenticate } from "@/lib/api/route";
import { getRideFor, partiesFor, toRideResource } from "@/lib/services/ride-flow";

/**
 * One ride, visible to the two people in it and nobody else.
 *
 * This doubles as the live channel: while a rider waits, polling here is what
 * moves the search on to the next round of drivers. Every few seconds is
 * plenty — an offer stands for thirty.
 */
export const GET = apiRoute(async (request: NextRequest, context: RouteContext<"/api/v1/rides/[id]">) => {
  const principal = await authenticate(request);
  const { id } = await context.params;

  const ride = await getRideFor({ audience: principal.audience, id: principal.id }, id);
  const parties = await partiesFor([ride]);
  return json({ ride: toRideResource(ride, parties.get(String(ride._id)), principal.audience) });
});
