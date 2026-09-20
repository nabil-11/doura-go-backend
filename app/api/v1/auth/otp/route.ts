import type { NextRequest } from "next/server";

import { apiRoute, clientIp, limit, readJson } from "@/lib/api/route";
import { json } from "@/lib/api/respond";
import { requestOtp, toE164 } from "@/lib/services/mobile-auth";
import { otpRequestSchema } from "@/lib/validation/api";

/**
 * Sends a verification code by SMS.
 *
 * Two limits guard it: one per number, so nobody's phone can be used as a
 * doorbell, and a wider one per address, against a script working through a
 * list. While no SMS provider is configured, non-production replies carry the
 * code in `debugCode` so the apps can be built against a real server.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJson(request, otpRequestSchema);
  const phone = toE164(body.phone);
  const ip = clientIp(request);

  limit(`otp:phone:${phone}`, 3, 15 * 60_000);
  limit(`otp:ip:${ip}`, 20, 60 * 60_000);

  const result = await requestOtp({ phone, audience: body.audience, ip });
  return json({ sent: true, expiresAt: result.expiresAt, ...(result.debugCode ? { debugCode: result.debugCode } : {}) });
});
