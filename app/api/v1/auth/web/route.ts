import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, clientIp, limit, readJson } from "@/lib/api/route";
import { closeWebSession, openWebSession } from "@/lib/api/web-auth";
import { webVerifySchema } from "@/lib/validation/api";

/**
 * A rider signing in from the website. The driver's door is next to this one,
 * at `/auth/web/driver`; both hand out an httpOnly cookie and nothing else.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJson(request, webVerifySchema);
  limit(`webverify:ip:${clientIp(request)}`, 30, 15 * 60_000);

  const result = await openWebSession("rider", {
    phone: body.phone,
    code: body.code,
    name: body.name,
    device: request.headers.get("user-agent"),
  });

  return json(
    { account: { id: result.accountId, isNew: result.isNewAccount } },
    result.isNewAccount ? 201 : 200,
  );
});

export const DELETE = apiRoute(async () => {
  await closeWebSession("rider");
  return json({ ok: true });
});
