// Sessions for the two apps that run in a browser rather than on a phone.
//
// The phone apps carry a bearer token, because they have somewhere safe to put
// one. A browser does not: anything JavaScript can read, an injected script can
// steal. So neither web app holds a token at all — the session lives in an
// httpOnly cookie, and the same `/api/v1` handlers read it instead of a header.
//
// Two spaces, two cookies, two audiences. A rider cookie must never open a
// driver's offers and a driver cookie must never book a ride; all of these are
// signed with the same secret, so the audience is what keeps them apart. Two
// separate cookies also means signing out of one space leaves the other alone
// — a household sharing a laptop is not a reason to lose your place.

import { SignJWT, jwtVerify } from "jose";

import type { MobileAudience } from "./audience";
import { secretKey } from "./token";

export const WEB_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const ISSUER = "doura-go";

const COOKIES: Record<MobileAudience, string> = {
  rider: "dg_rider",
  driver: "dg_driver",
};

const AUDIENCES: Record<MobileAudience, string> = {
  rider: "doura-go-web-rider",
  driver: "doura-go-web-driver",
};

export function webCookieName(space: MobileAudience) {
  return COOKIES[space];
}

export type WebSessionPayload = {
  /** Rider or driver id */
  sub: string;
  /** Token version — bumped to sign every device out. */
  ver: number;
};

export async function signWebSession(space: MobileAudience, payload: WebSessionPayload) {
  return new SignJWT({ ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCES[space])
    .setIssuedAt()
    .setExpirationTime(`${WEB_SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyWebSession(
  space: MobileAudience,
  token: string | undefined | null,
): Promise<WebSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCES[space],
    });
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number") return null;
    return { sub: payload.sub, ver: payload.ver };
  } catch {
    return null;
  }
}

/**
 * Which space a browser request belongs to.
 *
 * One origin serves both apps, so a browser can hold both cookies at once and
 * `GET /me` would otherwise be ambiguous. The client says which app is asking;
 * the rider app predates the header and is the default, so its requests are
 * unchanged.
 *
 * It doubles as a CSRF check for the driver space. A custom header cannot be
 * attached to a cross-origin request without a preflight, and `lib/api/cors.ts`
 * allows only `Authorization` and `Content-Type` — so a hostile page cannot ask
 * for the driver space at all, whatever cookies the browser would send.
 */
export const SPACE_HEADER = "x-dg-space";

export function requestedSpace(headers: { get(name: string): string | null }): MobileAudience {
  return headers.get(SPACE_HEADER) === "driver" ? "driver" : "rider";
}

/**
 * How the cookie is written. `lax` is the CSRF defence that matters: it keeps
 * the cookie off cross-site POSTs entirely, so another site cannot book a ride
 * in a signed-in rider's name. It still rides along on a top-level GET, which
 * is what lets someone follow a link back into a live ride — and a GET here
 * only returns JSON that a cross-origin page is not allowed to read.
 */
export function webCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: WEB_SESSION_TTL_SECONDS,
  };
}
