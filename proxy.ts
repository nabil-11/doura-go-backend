import { NextResponse, type NextRequest } from "next/server";

import { corsHeaders, isAllowedOrigin } from "@/lib/api/cors";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";
import { LOCALE_COOKIE, hasLocale, negotiateLocale } from "@/lib/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * 1. Cross-origin access for the mobile apps on /api/v1, preflight included.
 * 2. Every page lives under a locale prefix (/fr, /ar, /en). Requests without
 *    one are redirected to the remembered or negotiated locale.
 * 3. Optimistic auth for the backoffice: no valid session cookie → login page.
 *    This only reads the signed cookie. Real authorization happens in the data
 *    access layer (lib/auth/dal.ts) for every page and server action.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/v1")) {
    const origin = request.headers.get("origin");
    // Same-origin calls (curl, the website itself) send no Origin and need none.
    if (!isAllowedOrigin(origin)) {
      return request.method === "OPTIONS" ? new NextResponse(null, { status: 403 }) : NextResponse.next();
    }
    const headers = corsHeaders(origin);
    if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }

  const [, first = "", ...rest] = pathname.split("/");

  if (!hasLocale(first)) {
    const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = hasLocale(remembered)
      ? remembered
      : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = first;
  const subPath = `/${rest.join("/")}`;
  const isAdmin = subPath === "/admin" || subPath.startsWith("/admin/");

  // Server actions are POSTs to the page URL: let them through so they can
  // answer with a proper "session expired" state instead of a redirect.
  // Signed-in visitors on the login page are redirected by the page itself,
  // after a database check (a valid-looking cookie may belong to a disabled
  // account, and redirecting here would loop).
  if (isAdmin && request.method === "GET" && subPath !== "/admin/login") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await verifySessionToken(token);

    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/login`;
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      const response = NextResponse.redirect(url);
      if (token) response.cookies.delete(SESSION_COOKIE);
      return response;
    }
  }

  const response = NextResponse.next();
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals and files with an extension.
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
    // …plus the mobile API, which needs CORS headers and preflight answers.
    "/api/v1/:path*",
  ],
};
