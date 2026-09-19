// Session token signing and verification (HS256 JWT).
// Used by the proxy (optimistic checks) and by the data access layer.
// Kept free of `server-only` so the proxy can import it.

import { SignJWT, jwtVerify } from "jose";

import { isAdminRole, type AdminRole } from "./roles";

export const SESSION_COOKIE = "dg_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const ISSUER = "doura-go";
const AUDIENCE = "doura-go-backoffice";

export type SessionPayload = {
  /** Admin id */
  sub: string;
  role: AdminRole;
  /** Session version — bumped on password change or access removal */
  ver: number;
};

let cachedKey: Uint8Array | null = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long.");
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || !isAdminRole(payload.role) || typeof payload.ver !== "number") {
      return null;
    }
    return { sub: payload.sub, role: payload.role, ver: payload.ver };
  } catch {
    return null;
  }
}
