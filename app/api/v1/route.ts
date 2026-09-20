import { json } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { API_ERRORS } from "@/lib/api/errors";
import { siteConfig } from "@/lib/config/site";

/**
 * What lives under /api/v1. Handy when someone opens the base URL in a browser,
 * and it keeps the error vocabulary in one machine-readable place — the apps
 * switch on these codes to choose their own wording.
 */
export const GET = apiRoute(async () =>
  json({
    name: `${siteConfig.name} mobile API`,
    version: "1",
    auth: "Bearer access token; POST /api/v1/auth/otp to start",
    endpoints: {
      public: ["GET /api/v1/config"],
      auth: [
        "POST /api/v1/auth/otp",
        "POST /api/v1/auth/verify",
        "POST /api/v1/auth/refresh",
        "POST /api/v1/auth/logout",
      ],
      account: ["GET /api/v1/me", "PATCH /api/v1/me"],
      rider: [
        "POST /api/v1/rides/estimate",
        "POST /api/v1/rides",
        "GET /api/v1/rides",
        "GET /api/v1/rides/active",
        "GET /api/v1/rides/{id}",
        "POST /api/v1/rides/{id}/cancel",
        "POST /api/v1/rides/{id}/rate",
      ],
      driver: [
        "POST /api/v1/driver/availability",
        "POST /api/v1/driver/location",
        "GET /api/v1/driver/offers",
        "GET /api/v1/driver/earnings",
        "POST /api/v1/rides/{id}/accept",
        "POST /api/v1/rides/{id}/decline",
        "POST /api/v1/rides/{id}/arrive",
        "POST /api/v1/rides/{id}/start",
        "POST /api/v1/rides/{id}/complete",
        "POST /api/v1/rides/{id}/cancel",
      ],
    },
    errorCodes: Object.fromEntries(
      Object.entries(API_ERRORS).map(([code, { status }]) => [code, status]),
    ),
  }),
);
