import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { json } from "@/lib/api/respond";
import { apiRoute, authenticate, readJson } from "@/lib/api/route";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { Rider, type RiderRecord } from "@/lib/db/models/rider";
import { toDriverProfile, toRiderProfile } from "@/lib/services/driver-app";
import { profileSchema } from "@/lib/validation/api";

/** The signed-in account, shaped for whichever app is asking. */
export const GET = apiRoute(async (request: NextRequest) => {
  const principal = await authenticate(request);
  return principal.audience === "rider"
    ? json({ audience: "rider", rider: toRiderProfile(principal.rider) })
    : json({ audience: "driver", driver: await toDriverProfile(principal.driver) });
});

/**
 * Riders edit their own name and email. A driver's name comes from the ID
 * document the team checked, so only the email is theirs to change here —
 * anything else goes through support.
 */
export const PATCH = apiRoute(async (request: NextRequest) => {
  const principal = await authenticate(request);
  const body = await readJson(request, profileSchema);

  if (principal.audience === "rider") {
    const updated = await Rider.findByIdAndUpdate(
      principal.id,
      {
        $set: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email ?? null } : {}),
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean<RiderRecord>();
    if (!updated) throw new ApiError("notFound");
    return json({ audience: "rider", rider: toRiderProfile(updated) });
  }

  if (body.name !== undefined) throw new ApiError("forbidden", { name: "a driver's name is set from their ID" });

  const updated = await Driver.findByIdAndUpdate(
    principal.id,
    { $set: { email: body.email ?? null } },
    { returnDocument: "after", runValidators: true },
  ).lean<DriverRecord>();
  if (!updated) throw new ApiError("notFound");
  return json({ audience: "driver", driver: await toDriverProfile(updated) });
});
