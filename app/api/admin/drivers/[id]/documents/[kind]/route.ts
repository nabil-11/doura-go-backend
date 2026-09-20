import type { NextRequest } from "next/server";

import { authorize } from "@/lib/auth/dal";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/domain/driver";
import { getDriverFile } from "@/lib/services/drivers";
import { signedFileUrl } from "@/lib/storage/cloudinary";

/**
 * Streams a driver document to signed-in team members. Identity documents are
 * stored as private Cloudinary assets; their signed URL never reaches the browser.
 */
export async function GET(request: NextRequest, context: RouteContext<"/api/admin/drivers/[id]/documents/[kind]">) {
  const auth = await authorize("drivers:view");
  if (!auth.ok) return new Response(null, { status: auth.error === "unauthorized" ? 401 : 403 });

  const { id, kind } = await context.params;
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) return new Response(null, { status: 404 });

  const file = await getDriverFile(id, kind as DocumentKind);
  if (!file) return new Response(null, { status: 404 });

  const variant = request.nextUrl.searchParams.get("variant") === "original" ? "original" : "preview";
  const upstream = await fetch(signedFileUrl(file, variant), { cache: "no-store" });
  if (!upstream.ok) {
    console.error(`[documents] ${variant} fetch failed`, upstream.status, upstream.headers.get("x-cld-error"));
    return new Response(null, { status: 502 });
  }

  // Files are capped at 4 MB, so buffering keeps the response simple and atomic.
  const body = await upstream.arrayBuffer();
  const filename = `${kind}.${variant === "original" ? file.format : "jpg"}`;
  return new Response(body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
