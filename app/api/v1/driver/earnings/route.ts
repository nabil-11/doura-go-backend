import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, requireDriver } from "@/lib/api/route";
import { getDriverEarnings } from "@/lib/services/driver-app";

/**
 * What the driver has made: today, over the last seven days, and in total.
 * These are earnings after the platform's commission — the figure they keep.
 * Days are counted in Africa/Tunis, not in the server's time zone.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const { driver } = await requireDriver(request);
  return json({ earnings: await getDriverEarnings(driver) });
});
