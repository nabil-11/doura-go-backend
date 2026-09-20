import type { NextRequest } from "next/server";

import { apiRoute, clientIp, limit, readJson } from "@/lib/api/route";
import { json } from "@/lib/api/respond";
import { refreshSession } from "@/lib/services/mobile-auth";
import { refreshSchema } from "@/lib/validation/api";

/**
 * Trades a refresh token for a new pair. The old one stops working the moment
 * this succeeds, so the app must store what comes back before using it.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJson(request, refreshSchema);
  limit(`refresh:ip:${clientIp(request)}`, 60, 15 * 60_000);

  const tokens = await refreshSession({
    refreshToken: body.refreshToken,
    device: request.headers.get("user-agent"),
  });
  return json(tokens);
});
