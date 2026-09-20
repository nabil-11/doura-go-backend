// Cross-origin access for the mobile apps.
//
// A Capacitor app runs its web layer from its own scheme — `capacitor://localhost`
// on iOS, `http://localhost` on Android — so calls to this API are cross-origin
// and need permission. Browsers on the open web are not in the list: the apps
// are, and so is whatever you add to MOBILE_APP_ORIGINS.

const NATIVE_ORIGINS = ["capacitor://localhost", "ionic://localhost", "http://localhost", "https://localhost"];

// Vite and the Ionic dev server, so the apps can be developed in a browser.
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8100",
  "http://localhost:8101",
  "http://127.0.0.1:5173",
];

function allowedOrigins() {
  const configured = (process.env.MOBILE_APP_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([
    ...NATIVE_ORIGINS,
    ...(process.env.NODE_ENV === "production" ? [] : DEV_ORIGINS),
    ...configured,
  ]);
}

export function isAllowedOrigin(origin: string | null): origin is string {
  return !!origin && allowedOrigins().has(origin);
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
