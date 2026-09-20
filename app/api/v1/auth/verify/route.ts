import type { NextRequest } from "next/server";

import { apiRoute, clientIp, limit, readJson } from "@/lib/api/route";
import { json } from "@/lib/api/respond";
import { verifyOtp } from "@/lib/services/mobile-auth";
import { otpVerifySchema } from "@/lib/validation/api";

/**
 * Exchanges a verification code for a token pair.
 *
 * A rider signing in for the first time has no account yet, so the reply is
 * `nameRequired` — the app asks for a name and posts the same code again. The
 * code is only spent once it has actually produced a session.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJson(request, otpVerifySchema);
  limit(`verify:ip:${clientIp(request)}`, 30, 15 * 60_000);

  const result = await verifyOtp({
    phone: body.phone,
    audience: body.audience,
    code: body.code,
    name: body.name,
    device: request.headers.get("user-agent"),
  });

  return json(
    {
      ...result.tokens,
      account: { id: result.accountId, audience: result.audience, isNew: result.isNewAccount },
    },
    result.isNewAccount ? 201 : 200,
  );
});
