import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { json } from "@/lib/api/respond";
import { apiRoute, clientIp, limit, readJson } from "@/lib/api/route";
import { RIDER_COOKIE, riderCookieOptions, signRiderSession } from "@/lib/auth/rider-session";
import { revokeRefreshToken } from "@/lib/services/mobile-auth";
import { verifyOtp } from "@/lib/services/mobile-auth";
import { webVerifySchema } from "@/lib/validation/api";

/**
 * Signing in from the website.
 *
 * The same code, the same rider, the same checks as the app — the only
 * difference is where the session ends up. The app gets tokens it can store;
 * the browser gets an httpOnly cookie it cannot read, so an injected script
 * has nothing to steal. The refresh token issued along the way is spent
 * immediately: the cookie is the session, and a second way in would only be a
 * second thing to lose.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJson(request, webVerifySchema);
  limit(`webverify:ip:${clientIp(request)}`, 30, 15 * 60_000);

  const result = await verifyOtp({
    phone: body.phone,
    audience: "rider",
    code: body.code,
    name: body.name,
    device: request.headers.get("user-agent"),
  });

  // Only riders book from the website. A driver's number signing in here would
  // otherwise land them in a rider session against their own account.
  if (result.audience !== "rider") throw new ApiError("forbidden");

  await revokeRefreshToken(result.tokens.refreshToken);

  const store = await cookies();
  store.set(
    RIDER_COOKIE,
    await signRiderSession({ sub: result.accountId, ver: result.tokenVersion }),
    riderCookieOptions(),
  );

  return json({ account: { id: result.accountId, isNew: result.isNewAccount } }, result.isNewAccount ? 201 : 200);
});

/** Signing out: the cookie is the session, so dropping it is the whole job. */
export const DELETE = apiRoute(async () => {
  const store = await cookies();
  store.delete(RIDER_COOKIE);
  return json({ ok: true });
});
