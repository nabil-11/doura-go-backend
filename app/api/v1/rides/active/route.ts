import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, authenticate } from "@/lib/api/route";
import { getActiveRide, partiesFor, toRideResource } from "@/lib/services/ride-flow";

/**
 * The ride in progress, if there is one. This is what an app calls on launch,
 * to drop straight back into a ride that was under way when it was closed.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const principal = await authenticate(request);
  const ride = await getActiveRide({ audience: principal.audience, id: principal.id });
  if (!ride) return json({ ride: null });

  const parties = await partiesFor([ride]);
  return json({ ride: toRideResource(ride, parties.get(String(ride._id)), principal.audience) });
});
