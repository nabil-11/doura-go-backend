import type { NextRequest } from "next/server";

import { apiRoute, readJson } from "@/lib/api/route";
import { json } from "@/lib/api/respond";
import { revokeRefreshToken } from "@/lib/services/mobile-auth";
import { refreshSchema } from "@/lib/validation/api";

/**
 * Signs this device out by retiring its refresh token. The access token keeps
 * working until it expires (half an hour at most), so the app discards it too.
 * An unknown token is not an error: logging out always succeeds.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJson(request, refreshSchema);
  await revokeRefreshToken(body.refreshToken);
  return json({ signedOut: true });
});
