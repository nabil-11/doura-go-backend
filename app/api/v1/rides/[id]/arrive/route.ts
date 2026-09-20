import { driverStepRoute } from "@/lib/api/ride-steps";

/** The driver is at the pickup point and waiting: accepted → arriving. */
export const POST = driverStepRoute("arrive");
