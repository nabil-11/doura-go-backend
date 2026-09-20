import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, authenticate, limit, readQuery } from "@/lib/api/route";
import { getRoute } from "@/lib/services/routing";
import { routeQuerySchema } from "@/lib/validation/api";

/**
 * The streets between two points.
 *
 * A ride stores the route it was priced on, but a driver's own path changes as
 * they move: heading to the pickup, then to the destination. The driver app
 * asks for that leg here rather than calling a routing provider itself, so the
 * key stays on the server and the answers come out of the same cache.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const principal = await authenticate(request);
  const { fromLat, fromLng, toLat, toLng } = readQuery(request, routeQuerySchema);
  limit(`geo:route:${principal.id}`, 30, 60_000);

  const route = await getRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
  return json({
    route: route.geometry,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    source: route.source,
  });
});
