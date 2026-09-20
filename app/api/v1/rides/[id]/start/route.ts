import { driverStepRoute } from "@/lib/api/ride-steps";

/** The rider is on board and the trip has begun: arriving → in_progress. */
export const POST = driverStepRoute("start");
