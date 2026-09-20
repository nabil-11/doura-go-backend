import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, limit, readJson, requireDriver } from "@/lib/api/route";
import { DISPATCH } from "@/lib/domain/dispatch";
import { updateLocation } from "@/lib/services/driver-app";
import { locationSchema } from "@/lib/validation/api";

/**
 * Position heartbeat, sent while a driver is online or on a ride. It is what
 * puts them in range of a request and what draws the moto moving on the
 * rider's map. Stop sending it and they drop out of dispatch within two
 * minutes, even if the app never said goodbye.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const { id } = await requireDriver(request);
  const body = await readJson(request, locationSchema);
  limit(`driver:location:${id}`, 60, 60_000);

  const at = await updateLocation(id, body);
  return json({ at, nextWithinSeconds: DISPATCH.heartbeatSeconds });
});
