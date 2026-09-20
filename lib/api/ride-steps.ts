import "server-only";

import type { NextRequest } from "next/server";

import type { RideStep } from "@/lib/domain/ride";
import { advanceRide, partiesFor, toRideResource } from "@/lib/services/ride-flow";
import { completeSchema } from "@/lib/validation/api";

import { json } from "./respond";
import { apiRoute, readJson, requireDriver } from "./route";

type IdContext = { params: Promise<{ id: string }> };

/**
 * The driver's three buttons — arrived, started, finished — are the same
 * handler with a different step. Each one is refused unless the ride is in a
 * status that step can follow, so the sequence holds even over a bad
 * connection where requests arrive twice or out of order.
 */
export function driverStepRoute(step: RideStep) {
  return apiRoute(async (request: NextRequest, context: IdContext) => {
    const { driver } = await requireDriver(request, { approved: true });
    const { id } = await context.params;

    // Only finishing a ride carries a payload: what was actually ridden.
    const actuals = step === "complete" ? await readJson(request, completeSchema) : undefined;

    const { ride, fareChanged } = await advanceRide(driver, id, step, actuals);
    const parties = await partiesFor([ride]);
    return json({ ride: toRideResource(ride, parties.get(String(ride._id)), "driver"), fareChanged });
  });
}
