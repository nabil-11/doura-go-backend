import { authorize } from "@/lib/auth/dal";
import { getLiveSnapshot } from "@/lib/services/live";

/**
 * Feeds the operations map. Polled every few seconds by the page, so it stays
 * a plain read: no aggregation, capped result sets, never cached.
 */
export async function GET() {
  const auth = await authorize("rides:view");
  if (!auth.ok) return new Response(null, { status: auth.error === "unauthorized" ? 401 : 403 });

  const snapshot = await getLiveSnapshot();
  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
