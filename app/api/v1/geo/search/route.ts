import type { NextRequest } from "next/server";

import { json } from "@/lib/api/respond";
import { apiRoute, authenticate, limit, readQuery } from "@/lib/api/route";
import { searchPlaces } from "@/lib/services/places";
import { placeSearchSchema } from "@/lib/validation/api";

/**
 * Address search for the apps.
 *
 * It runs here rather than in the phone so the geocoding key stays on the
 * server. The apps debounce, but the limit below is what actually protects the
 * bill if one ever stops.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const principal = await authenticate(request);
  const { q, lat, lng, lang } = readQuery(request, placeSearchSchema);
  limit(`geo:search:${principal.id}`, 40, 60_000);

  const near = lat !== undefined && lng !== undefined ? { lat, lng } : null;
  return json({ places: await searchPlaces(q, near, lang) });
});
