// Cross-origin access for the mobile apps.
//
// A Capacitor app runs its web layer from its own scheme — `capacitor://localhost`
// on iOS, `http://localhost` on Android — so calls to this API are cross-origin
// and need permission. Browsers on the open web are not in the list: the apps
// are, and so is whatever you add to MOBILE_APP_ORIGINS.

const NATIVE_ORIGINS = ["capacitor://localhost", "ionic://localhost", "http://localhost", "https://localhost"];

/**
 * Any port on this machine, while developing. Vite moves to the next free port
 * when one is taken — run both apps at once and the second lands on 5174 — so
 * naming ports here only produces a confusing "can't reach the server" later.
 */
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function configuredOrigins() {
  return (process.env.MOBILE_APP_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (NATIVE_ORIGINS.includes(origin)) return true;
  if (configuredOrigins().includes(origin)) return true;
  return process.env.NODE_ENV !== "production" && LOCAL_ORIGIN.test(origin);
}

/**
 * Headers for an allowed origin. Credentials are deliberately absent: the apps
 * authenticate with a bearer token, never a cookie, so there is nothing for a
 * hostile page to ride on even if one did get through.
 */
export function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
