import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, limit, readJson, requireRider } from "@/lib/api/route";
import { estimateRide } from "@/lib/services/ride-flow";
import { estimateSchema } from "@/lib/validation/api";

/**
 * What a trip would cost. Nothing is stored, so the app can call it as the
 * rider drags the pin around — within reason.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const { id } = await requireRider(request);
  const body = await readJson(request, estimateSchema);
  limit(`ride:estimate:${id}`, 120, 60_000);

  const estimate = await estimateRide(body.pickup, body.dropoff);
  return json({ estimate });
});
