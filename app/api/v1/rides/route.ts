import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, authenticate, limit, readJson, readQuery, requireRider } from "@/lib/api/route";
import { listRidesFor, partiesFor, requestRide, toRideResource } from "@/lib/services/ride-flow";
import { pageQuerySchema, requestRideSchema } from "@/lib/validation/api";

/** Ride history — the rider's or the driver's, depending on the token. */
export const GET = apiRoute(async (request: NextRequest) => {
  const principal = await authenticate(request);
  const { page, pageSize } = readQuery(request, pageQuerySchema);

  const result = await listRidesFor({ audience: principal.audience, id: principal.id }, { page, pageSize });
  const parties = await partiesFor(result.items);

  return json({
    rides: result.items.map((ride) => toRideResource(ride, parties.get(String(ride._id)), principal.audience)),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    pageCount: result.pageCount,
  });
});

/**
 * Requests a ride. The fare is priced and the search for a driver starts
 * immediately; the app then follows the ride with GET /rides/{id}, which is
 * also what keeps the search moving.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const { id, rider } = await requireRider(request);
  const body = await readJson(request, requestRideSchema);
  limit(`ride:request:${id}`, 10, 60 * 60_000);

  const ride = await requestRide({
    riderId: id,
    pickup: body.pickup,
    dropoff: body.dropoff,
    paymentMethod: body.paymentMethod,
  });

  return json({ ride: toRideResource(ride, { rider }, "rider") }, 201);
});
