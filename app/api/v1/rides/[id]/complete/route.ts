import { driverStepRoute } from "@/lib/api/ride-steps";

/**
 * The trip is over: in_progress → completed. An optional body of
 * `{ distanceKm, durationMin }` re-prices the ride on what was actually
 * ridden; the driver's earnings and the rider's history are updated here.
 */
export const POST = driverStepRoute("complete");
