import type { NextRequest } from "next/server";

import { apiRoute, clientIp, limit, readJson } from "@/lib/api/route";
import { json } from "@/lib/api/respond";
import { isTestNumber } from "@/lib/auth/test-numbers";
import { requestOtp, toE164 } from "@/lib/services/mobile-auth";
import { otpRequestSchema } from "@/lib/validation/api";

/**
 * Sends a verification code by SMS.
 *
 * Two limits guard it: one per number, so nobody's phone can be used as a
 * doorbell, and a wider one per address, against a script working through a
 * list. A configured test number skips the first: it sends no SMS, so there is
 * nobody to disturb, and its code is fixed rather than returned here.
 *
 * While no SMS provider is configured, non-production replies carry the code in
 * `debugCode` so the apps can be built against a real server.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJson(request, otpRequestSchema);
  const phone = toE164(body.phone);
  const ip = clientIp(request);

  if (!isTestNumber(phone)) limit(`otp:phone:${phone}`, 3, 15 * 60_000);
  limit(`otp:ip:${ip}`, 20, 60 * 60_000);

  const result = await requestOtp({ phone, audience: body.audience, ip });
  return json({ sent: true, expiresAt: result.expiresAt, ...(result.debugCode ? { debugCode: result.debugCode } : {}) });
});
