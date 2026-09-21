"use client";

import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import { DriveApiError } from "@/lib/drive/api";

import { StageMap } from "@/components/shared/stage";

/**
 * The driver app's own pieces. The frame it sits in — the map, the sheet, the
 * centred page — is shared with the rider app and lives in
 * `components/shared/stage.tsx`; it is re-exported here so this file stays the
 * one import every driver screen needs.
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

/** The map, filling the stage. */
export const DriveMap = StageMap;

/** Everything the driver app says, handed down from the server component. */
export type DriveCopy = Dictionary["driverPage"];
export type CommonCopy = Dictionary["common"];

/**
 * The failure a driver should read.
 *
 * The API's own `message` is English and written for whoever is reading logs,
 * so only the `code` crosses over: it picks a translated line, and anything
 * unrecognised falls back to the general one.
 */
export function messageFor(copy: DriveCopy, error: unknown) {
  if (error instanceof DriveApiError && error.code in copy.errors) {
    return copy.errors[error.code as keyof DriveCopy["errors"]];
  }
  return copy.errors.generic;
}

/** "4,2 km · 11 min" — the trip in one line, in the reader's numerals. */
export function tripLine(
  common: CommonCopy,
  locale: Locale,
  distanceKm: number,
  durationMin: number,
) {
  const distance = interpolate(common.kilometersShort, {
    count: formatNumber(locale, distanceKm, { maximumFractionDigits: 1 }),
  });
  const duration = interpolate(common.minutesShort, {
    count: formatNumber(locale, Math.round(durationMin)),
  });
  return `${distance} · ${duration}`;
}

/** A stop with coordinates, or nothing to point at. */
export function pointOf(stop: { lat: number | null; lng: number | null }) {
  return stop.lat !== null && stop.lng !== null ? { lat: stop.lat, lng: stop.lng } : null;
}

/** The frame the two map-less tabs share: a title, then a scrolling column. */
export function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}
