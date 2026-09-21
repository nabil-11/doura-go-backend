import "server-only";

import { cookies } from "next/headers";

import type { MobileAudience } from "@/lib/auth/audience";
import { signWebSession, webCookieName, webCookieOptions } from "@/lib/auth/web-session";
import { revokeRefreshToken, verifyOtp } from "@/lib/services/mobile-auth";

import { ApiError } from "./errors";

/**
 * Signing in from the website.
 *
 * The same code, the same account, the same checks as the phone app — the only
 * difference is where the session ends up. The app gets tokens it can store;
 * the browser gets an httpOnly cookie it cannot read, so an injected script has
 * nothing to steal. The refresh token issued along the way is spent
 * immediately: the cookie is the session, and a second way in would only be a
 * second thing to lose.
 */
export async function openWebSession(
  space: MobileAudience,
  input: { phone: string; code: string; name?: string; device?: string | null },
) {
  const result = await verifyOtp({
    phone: input.phone,
    audience: space,
    code: input.code,
    name: input.name,
    device: input.device ?? null,
  });

  // Belt and braces: the audience asked for is the audience that came back, so
  // a driver's number can never end up holding a rider session on their own
  // account, or the other way round.
  if (result.audience !== space) throw new ApiError("forbidden");

  await revokeRefreshToken(result.tokens.refreshToken);

  const store = await cookies();
  store.set(
    webCookieName(space),
    await signWebSession(space, { sub: result.accountId, ver: result.tokenVersion }),
    webCookieOptions(),
  );

  return result;
}

/** Signing out: the cookie is the session, so dropping it is the whole job. */
export async function closeWebSession(space: MobileAudience) {
  const store = await cookies();
  store.delete(webCookieName(space));
}
