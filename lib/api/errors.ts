// Every failure the mobile API can return, with its HTTP status.
//
// The `code` is the contract: apps switch on it and show their own translated
// message. The `message` in the body is for whoever is reading logs or building
// the client — never put it in front of a rider.

export const API_ERRORS = {
  // Request shape and access
  invalidRequest: { status: 400, message: "The request body or query is not valid." },
  unauthorized: { status: 401, message: "A valid access token is required." },
  forbidden: { status: 403, message: "This token may not perform that action." },
  notFound: { status: 404, message: "No such resource." },
  rateLimited: { status: 429, message: "Too many requests. Try again later." },
  serverError: { status: 500, message: "Something went wrong on our side." },

  // Sign-in
  invalidCode: { status: 401, message: "That verification code is not correct." },
  codeExpired: { status: 410, message: "That verification code has expired. Request a new one." },
  tooManyAttempts: { status: 429, message: "Too many attempts for this code. Request a new one." },
  nameRequired: { status: 422, message: "A name is required to create the account." },
  notRegistered: { status: 403, message: "No driver account for this number. Apply on the website first." },
  accountBlocked: { status: 403, message: "This account is blocked. Contact support." },
  invalidRefreshToken: { status: 401, message: "That refresh token is unknown, used or expired." },
  smsUnavailable: { status: 502, message: "The verification code could not be sent." },

  // Riding
  outsideServiceArea: { status: 422, message: "That pickup point is outside the service area." },
  rideInProgress: { status: 409, message: "This account already has a ride under way." },
  driverNotActive: { status: 403, message: "This driver account is not approved for rides." },
  driverOffline: { status: 409, message: "Go online before taking rides." },
  commissionDue: {
    status: 403,
    message: "Settle the commission owed to Doura Go before taking more rides.",
  },
  offerExpired: { status: 409, message: "That ride is no longer on offer." },
  invalidTransition: { status: 409, message: "The ride is not in a state that allows this." },
  alreadyRated: { status: 409, message: "This ride has already been rated." },
  handoverRequired: { status: 422, message: "Ask the rider for their code." },
  handoverWrong: { status: 422, message: "That code does not match. Check it with the rider." },
  handoverLocked: {
    status: 423,
    message: "Too many wrong codes. The rider has been given a new one.",
  },
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(code: ApiErrorCode, details?: Record<string, string>) {
    super(API_ERRORS[code].message);
    this.name = "ApiError";
    this.code = code;
    this.status = API_ERRORS[code].status;
    this.details = details;
  }
}
