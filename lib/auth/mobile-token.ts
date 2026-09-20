// Credentials for the rider and driver apps.
//
// Mobile clients can't hold a cookie the way the backoffice does, so they carry
// a short-lived access token in `Authorization: Bearer …` and swap a long-lived
// refresh token for a new pair when it expires. The audience claim keeps the
// two worlds apart: a backoffice session is never accepted here, and neither is
// a rider token on a driver endpoint.

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { isMobileAudience, type MobileAudience } from "./audience";
import { secretKey } from "./token";

const ISSUER = "doura-go";
const AUDIENCE = "doura-go-mobile";

/** Short enough that a stolen access token ages out quickly. */
export const ACCESS_TTL_SECONDS = 30 * 60;
/** Long enough that an app used weekly never asks for a code again. */
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 60;

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;

export type MobilePrincipal = {
  /** Rider or Driver id */
  id: string;
  audience: MobileAudience;
  /** Token version — bumped to sign every device out */
  ver: number;
};

export async function signAccessToken(principal: MobilePrincipal) {
  return new SignJWT({ use: principal.audience, ver: principal.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(principal.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string | undefined | null): Promise<MobilePrincipal | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || !isMobileAudience(payload.use) || typeof payload.ver !== "number") {
      return null;
    }
    return { id: payload.sub, audience: payload.use, ver: payload.ver };
  } catch {
    return null;
  }
}

/** Reads the bearer token out of an Authorization header. */
export function bearerToken(header: string | null) {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim() || null;
}

/** Opaque refresh token: random, never derived from anything. */
export function newRefreshToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Keyed hash for values stored in the database (refresh tokens, OTP codes).
 * The key lives in the environment, so a leaked collection can't be reversed —
 * which matters most for six-digit codes, where a plain hash is no protection.
 */
export function hashSecretValue(value: string) {
  return createHmac("sha256", secretKey()).update(value).digest("hex");
}

export function newOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Binds a code to the phone and app it was issued for. */
export function hashOtpCode(phone: string, audience: MobileAudience, code: string) {
  return hashSecretValue(`otp:${audience}:${phone}:${code}`);
}

export function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
