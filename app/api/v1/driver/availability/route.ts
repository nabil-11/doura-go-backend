import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, readJson, requireDriver } from "@/lib/api/route";
import { setAvailability, toDriverProfile } from "@/lib/services/driver-app";
import { availabilitySchema } from "@/lib/validation/api";

/**
 * The "go online" switch. Going online needs a position — dispatch has nothing
 * to work with otherwise — and is refused unless the account is approved. A
 * driver in the middle of a ride cannot go offline.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const { driver } = await requireDriver(request);
  const body = await readJson(request, availabilitySchema);

  const updated = await setAvailability(driver, body.availability, body.location);
  return json({ driver: await toDriverProfile(updated) });
});
