// The two handovers, as the driver web app has to deal with them.
//
// The rider holds a four-digit code for starting and another for finishing.
// The driver cannot move the ride on without one, which is what proves the two
// of them were standing in the same place. The rider shows the code as digits
// and as a QR; this file understands the QR.
//
// The payload itself is parsed by `lib/domain/ride.ts` — the same function the
// server checks against, imported rather than mirrored, so the two can never
// drift apart.

import { HANDOVER_CODE_PATTERN, parseHandoverPayload, type Handover } from "@/lib/domain/ride";

export const HANDOVER_CODE_LENGTH = 4;

export function isHandoverCode(value: string) {
  return HANDOVER_CODE_PATTERN.test(value);
}

/** Keeps only digits, and never more than a code's worth of them. */
export function cleanHandoverCode(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, HANDOVER_CODE_LENGTH);
}

/** Why a scanned QR is not the one we are waiting for. */
export type ScanMismatch = "notOurs" | "otherRide" | "otherStep";

/**
 * Checks a scan against the ride in hand before anything is sent. A QR from
 * another rider's screen, or the finish code when we are trying to start, is a
 * doomed request — better to say which mistake it was than to let the server
 * spend one of the driver's five tries on it.
 */
export function readScan(
  scanned: string,
  expect: { rideId: string; handover: Handover },
): { ok: true; code: string } | { ok: false; reason: ScanMismatch } {
  const payload = parseHandoverPayload(scanned);
  if (!payload) return { ok: false, reason: "notOurs" };
  if (payload.rideId !== expect.rideId) return { ok: false, reason: "otherRide" };
  if (payload.handover !== expect.handover) return { ok: false, reason: "otherStep" };
  return { ok: true, code: payload.code };
}
