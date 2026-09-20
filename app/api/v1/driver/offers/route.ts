import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, requireDriver } from "@/lib/api/route";
import { DISPATCH } from "@/lib/domain/dispatch";
import { fromGeoPoint } from "@/lib/domain/geo";
import { offersForDriver } from "@/lib/services/dispatch";
import { toOfferResource } from "@/lib/services/ride-flow";

/**
 * Ride requests waiting for this driver's answer, with what each one pays and
 * how far the pickup is. Each offer carries its own `expiresAt`: after that it
 * goes to the next drivers, so the app should poll every few seconds while the
 * driver is online and idle.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const { id, driver } = await requireDriver(request, { approved: true });

  const rides = driver.availability === "online" ? await offersForDriver(id) : [];
  const from = fromGeoPoint(driver.location);

  return json({
    offers: rides.map((ride) => toOfferResource(ride, from)),
    availability: driver.availability,
    offerSeconds: DISPATCH.offerSeconds,
  });
});
