import "server-only";

import { isValidObjectId } from "mongoose";
import type { NextRequest } from "next/server";
import type { z } from "zod";

import { bearerToken, verifyAccessToken } from "@/lib/auth/mobile-token";
import { RIDER_COOKIE, verifyRiderSession } from "@/lib/auth/rider-session";
import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { Rider, type RiderRecord } from "@/lib/db/models/rider";
import { rateLimit } from "@/lib/rate-limit";

import { ApiError } from "./errors";
import { errorResponse } from "./respond";

/**
 * Wraps a route handler so every failure leaves as the same JSON envelope.
 * Throw an `ApiError` anywhere inside and the right status comes out; anything
 * else is logged and becomes a 500 without leaking internals.
 */
export function apiRoute<C>(handler: (request: NextRequest, context: C) => Promise<Response>) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Parses and validates a JSON body; invalid input names the offending fields.
 * An empty body reads as "nothing supplied", so endpoints whose fields are all
 * optional can be called with no body at all.
 */
export async function readJson<T>(request: NextRequest, schema: z.ZodType<T>): Promise<T> {
  const text = await request.text();
  let raw: unknown;
  if (text.trim() === "") {
    raw = undefined;
  } else {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ApiError("invalidRequest", { body: "expected JSON" });
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.map(String).join(".") || "body";
      details[field] ??= issue.message;
    }
    throw new ApiError("invalidRequest", details);
  }
  return parsed.data;
}

export function readQuery<T>(request: NextRequest, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) throw new ApiError("invalidRequest");
  return parsed.data;
}

export function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Fixed-window limit; throws instead of returning, so callers stay linear. */
export function limit(key: string, max: number, windowMs: number) {
  if (!rateLimit(key, max, windowMs).ok) throw new ApiError("rateLimited");
}

export type RiderPrincipal = { audience: "rider"; id: string; rider: RiderRecord };
export type DriverPrincipal = { audience: "driver"; id: string; driver: DriverRecord };
export type Principal = RiderPrincipal | DriverPrincipal;

/**
 * The rider named by the website's session cookie, in the shape a bearer token
 * would have produced. Always a rider: there is no web driver app, and issuing
 * a driver principal from a cookie is not a door worth opening.
 */
async function webRiderPrincipal(request: NextRequest) {
  const session = await verifyRiderSession(request.cookies.get(RIDER_COOKIE)?.value);
  return session ? { audience: "rider" as const, id: session.sub, ver: session.ver } : null;
}

/**
 * The account behind the request, re-read from the database every time: a
 * blocked rider or a signed-out device loses access immediately, without
 * waiting for a token to expire.
 *
 * Two ways in, for two kinds of client. The phone apps send a bearer token.
 * The website has nowhere safe to keep one, so it sends an httpOnly cookie
 * instead and never touches a token at all — that cookie can only ever name a
 * rider, so a driver endpoint refuses it on the audience check below.
 */
export async function authenticate(request: NextRequest): Promise<Principal> {
  const header = request.headers.get("authorization");
  const principal = header
    ? await verifyAccessToken(bearerToken(header))
    : await webRiderPrincipal(request);
  if (!principal || !isValidObjectId(principal.id)) throw new ApiError("unauthorized");

  await connectToDatabase();

  if (principal.audience === "rider") {
    const rider = await Rider.findById(principal.id).lean<RiderRecord>();
    if (!rider || (rider.tokenVersion ?? 1) !== principal.ver) throw new ApiError("unauthorized");
    if (rider.status === "blocked") throw new ApiError("accountBlocked");
    return { audience: "rider", id: String(rider._id), rider };
  }

  const driver = await Driver.findById(principal.id).lean<DriverRecord>();
  if (!driver || (driver.tokenVersion ?? 1) !== principal.ver) throw new ApiError("unauthorized");
  return { audience: "driver", id: String(driver._id), driver };
}

export async function requireRider(request: NextRequest): Promise<RiderPrincipal> {
  const principal = await authenticate(request);
  if (principal.audience !== "rider") throw new ApiError("forbidden");
  return principal;
}

/**
 * `approved` is for anything that touches a real ride. Pending, rejected and
 * suspended drivers still get a session — they need to open the app to see
 * where their application stands.
 */
export async function requireDriver(
  request: NextRequest,
  { approved = false }: { approved?: boolean } = {},
): Promise<DriverPrincipal> {
  const principal = await authenticate(request);
  if (principal.audience !== "driver") throw new ApiError("forbidden");
  if (approved && principal.driver.status !== "active") throw new ApiError("driverNotActive");
  return principal;
}
