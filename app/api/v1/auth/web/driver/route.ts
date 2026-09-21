import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, clientIp, limit, readJson } from "@/lib/api/route";
import { closeWebSession, openWebSession } from "@/lib/api/web-auth";
import { driverWebVerifySchema } from "@/lib/validation/api";

/**
 * A driver signing in to the driver space on the website.
 *
 * No name is taken here, unlike the rider door: a driver account is created by
 * the team from a vetted application, so an unknown number is refused rather
 * than signed up. What comes back is a session cookie for the driver space
 * alone — it opens nothing a rider cookie opens, and vice versa.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJson(request, driverWebVerifySchema);
  limit(`webverify:driver:ip:${clientIp(request)}`, 30, 15 * 60_000);

  const result = await openWebSession("driver", {
    phone: body.phone,
    code: body.code,
    device: request.headers.get("user-agent"),
  });

  return json({ account: { id: result.accountId } });
});

export const DELETE = apiRoute(async () => {
  await closeWebSession("driver");
  return json({ ok: true });
});
