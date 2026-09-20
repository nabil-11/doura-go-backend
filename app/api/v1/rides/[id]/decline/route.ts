import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, requireDriver } from "@/lib/api/route";
import { declineOffer } from "@/lib/services/dispatch";

/**
 * Passes on an offer. The ride carries on looking without this driver, who is
 * not shown it again — declining costs them nothing and keeps the search
 * moving instead of burning the whole thirty-second window.
 */
export const POST = apiRoute(async (request: NextRequest, context: RouteContext<"/api/v1/rides/[id]/decline">) => {
  const { id: driverId } = await requireDriver(request, { approved: true });
  const { id } = await context.params;

  await declineOffer(id, driverId);
  return json({ declined: true });
});
