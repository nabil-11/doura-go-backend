"use client";

import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import { RideApiError } from "@/lib/ride/api";

import { StageMap } from "@/components/shared/stage";

/**
 * The rider app's own pieces. The frame it sits in — the map, the sheet, the
 * centred page — is shared with the driver app and lives in
 * `components/shared/stage.tsx`; it is re-exported here so this file stays the
 * one import every rider screen needs.
 */
export {
  CenteredStage,
  Notice,
  Panel,
  SHEET_INSET,
  Stage,
  isAborted,
  useWideLayout,
} from "@/components/shared/stage";

/** The map, filling the stage. Named for the app that uses it. */
export const RideMap = StageMap;

/** Everything the rider app says, handed down from the server component. */
export type RideCopy = Dictionary["ridePage"];
export type CommonCopy = Dictionary["common"];

/**
 * The failure a rider should read.
 *
 * The API's own `message` is English and written for whoever is reading logs,
 * so only the `code` crosses over: it picks a translated line, and anything
 * unrecognised falls back to the general one.
 */
export function messageFor(copy: RideCopy, error: unknown) {
  if (error instanceof RideApiError && error.code in copy.errors) {
    return copy.errors[error.code as keyof RideCopy["errors"]];
  }
  return copy.errors.generic;
}

/** "4,2 km · about 11 min" — the trip in one line, in the reader's numerals. */
export function tripSummary(
  copy: RideCopy,
  common: CommonCopy,
  locale: Locale,
  distanceKm: number,
  durationMin: number,
) {
  return interpolate(copy.book.tripSummary, {
    distance: interpolate(common.kilometersShort, {
      count: formatNumber(locale, distanceKm, { maximumFractionDigits: 1 }),
    }),
    duration: interpolate(common.minutesShort, {
      count: formatNumber(locale, Math.round(durationMin)),
    }),
  });
}
