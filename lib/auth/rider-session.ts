// The rider's session when they book from the website rather than the app.
//
// The phone apps carry a bearer token, because they have somewhere safe to put
// one. A browser does not: anything JavaScript can read, an injected script can
// steal. So the web rider never holds a token at all — the session lives in an
// httpOnly cookie, and the same `/api/v1` handlers read it instead of a header.
//
// Its own audience, deliberately. A backoffice cookie must never open a rider's
// rides, and a rider cookie must never reach a driver endpoint; both are
// signed with the same secret, so the audience is what keeps them apart.

import { SignJWT, jwtVerify } from "jose";

import { secretKey } from "./token";

export const RIDER_COOKIE = "dg_rider";
export const RIDER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const ISSUER = "doura-go";
const AUDIENCE = "doura-go-web-rider";

export type RiderSessionPayload = {
  /** Rider id */
  sub: string;
  /** Token version — bumped to sign every device out. */
  ver: number;
};

export async function signRiderSession(payload: RiderSessionPayload) {
  return new SignJWT({ ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${RIDER_SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyRiderSession(
  token: string | undefined | null,
): Promise<RiderSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number") return null;
    return { sub: payload.sub, ver: payload.ver };
  } catch {
    return null;
  }
}

/**
 * How the cookie is written. `lax` is the CSRF defence that matters: it keeps
 * the cookie off cross-site POSTs entirely, so another site cannot book a ride
 * in a signed-in rider's name. It still rides along on a top-level GET, which
 * is what lets someone follow a link back into a live ride — and a GET here
 * only returns JSON that a cross-origin page is not allowed to read.
 */
export function riderCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: RIDER_SESSION_TTL_SECONDS,
  };
}
