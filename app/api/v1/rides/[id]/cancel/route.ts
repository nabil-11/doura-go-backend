import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, authenticate, readJson } from "@/lib/api/route";
import { cancelRide, partiesFor, toRideResource } from "@/lib/services/ride-flow";
import { cancelSchema } from "@/lib/validation/api";

/**
 * Calls a ride off. It means different things on the two sides: a rider ends
 * it — with a fee once a driver is already riding over — while a driver hands
 * it back to the pool and the search starts again. Once the rider is on board,
 * neither side can cancel; that is a support matter.
 */
export const POST = apiRoute(async (request: NextRequest, context: RouteContext<"/api/v1/rides/[id]/cancel">) => {
  const principal = await authenticate(request);
  const { id } = await context.params;
  const body = await readJson(request, cancelSchema);

  const result = await cancelRide({ audience: principal.audience, id: principal.id }, id, body.reason);
  const parties = await partiesFor([result.ride]);

  return json({
    ride: toRideResource(result.ride, parties.get(String(result.ride._id)), principal.audience),
    fee: result.fee,
    /** True when a driver handed the ride back and it is looking again. */
    released: result.released,
  });
});
