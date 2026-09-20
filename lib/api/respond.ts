import { API_ERRORS, ApiError, type ApiErrorCode } from "./errors";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** A successful JSON response. Nothing from this API is cacheable. */
export function json<T extends object>(data: T, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}

export function apiError(code: ApiErrorCode, details?: Record<string, string>) {
  const { status, message } = API_ERRORS[code];
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers: NO_STORE });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return apiError(error.code, error.details);
  console.error("[api] unhandled", error);
  return apiError("serverError");
}
