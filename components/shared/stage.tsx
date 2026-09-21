"use client";

import { CircleAlertIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { MapView } from "@/components/map/map-view";
import { cn } from "@/lib/utils";

/**
 * The frame both map apps are built in: a full-bleed map with a sheet over the
 * bottom of it on a phone, and the two side by side on a desktop.
 *
 * Shared because the rider's screens and the driver's screens are the same
 * shape — and because the parts of it that are easy to get wrong (a definite
 * height for Leaflet, a ceiling on how much the sheet may take) were learned
 * once and should not have to be learned twice.
 */

/** An aborted request is a screen changing its mind, not a failure to report. */
export function isAborted(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Wide enough for the map and the panel to sit side by side. */
const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Narrow screens get the phone layout — a full-bleed map with a sheet over the
 * bottom of it. Wide ones put the panel beside the map instead, where nothing
 * is hidden and `sheetInset` has nothing to correct for.
 */
export function useWideLayout() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

/** The share of the map height the sheet covers on a phone. */
export const SHEET_INSET = 0.46;

/**
 * Fills the window under the sticky site header — a definite height, not a
 * minimum. Leaflet sizes itself to its container, and a percentage height
 * inside a `min-h` box has nothing firm to resolve against: the map comes out
 * zero pixels tall and draws no tiles at all.
 */
export const STAGE_HEIGHT = "h-[calc(100svh-4rem)]";

/**
 * Map behind, sheet in front.
 *
 * On a phone the stage is exactly one screen — never `min-h` — and the sheet is
 * anchored to the bottom of it with a ceiling on how much it may take. That
 * ceiling is the whole point: a picker with a search box, a list of results and
 * a pin card is easily taller than a phone, and without a limit it grows over
 * the map until there is nothing left to aim with. The sheet scrolls inside
 * itself instead, so a slice of map is always visible and always draggable.
 *
 * `tall` is for the screens that are mostly reading — a list of results. A
 * screen whose job is to point at something on the map asks for the opposite.
 */
export function Stage({
  map,
  children,
  overlay,
  tall = true,
  fill = false,
}: {
  map: React.ReactNode;
  children: React.ReactNode;
  /** Floats over the top of the map — the trip, while the map shows it. */
  overlay?: React.ReactNode;
  tall?: boolean;
  /**
   * Fill the parent instead of the window. For a stage that shares the screen
   * with something else of its own — a tab bar under it, say — where a stage
   * one window tall would push that off the bottom.
   */
  fill?: boolean;
}) {
  // Both columns are told their height outright, because Leaflet measures its
  // container and a percentage of an indefinite parent measures zero.
  const stageHeight = fill ? "h-full" : STAGE_HEIGHT;
  const columnHeight = fill ? "lg:h-full" : "lg:h-[calc(100svh-4rem)]";
  return (
    <div
      className={cn(
        "relative isolate",
        stageHeight,
        "lg:grid lg:grid-cols-[minmax(0,1fr)_27rem]",
        // Aiming stacks instead of overlapping: the map takes one grid row and
        // the sheet the other, so the crosshair — which marks the centre of the
        // map element — lands in the middle of what the rider can actually see.
        // Grid rows rather than flex, because `minmax(0,1fr)` is a definite
        // track: the map gets a real height to size its tiles against.
        //
        // `max-lg:` throughout, never a base utility undone by `lg:`. `lg:block`
        // and `lg:grid` are the same kind of utility, so one silently wins and
        // the desktop column disappears.
        !tall && "max-lg:grid max-lg:grid-rows-[minmax(0,1fr)_auto]",
      )}
    >
      <div
        className={cn(
          "relative",
          tall ? "absolute inset-0" : "max-lg:min-h-0",
          "lg:relative lg:inset-auto",
          columnHeight,
        )}
      >
        {map}
        {/* Over the map, not above it in the sheet: the two ends of the trip
            belong next to the line drawn between them. `pointer-events-none`
            on the frame keeps the map draggable everywhere the card is not. */}
        {overlay ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[700] p-3 sm:p-4">
            <div className="pointer-events-auto mx-auto max-w-lg lg:max-w-xl">{overlay}</div>
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "z-10 flex min-h-0 flex-col overflow-y-auto overscroll-contain",
          tall
            ? "absolute inset-x-0 bottom-0 max-h-[76%] justify-end"
            : "max-lg:max-h-[58%]",
          "lg:static lg:max-h-none lg:justify-start lg:border-s lg:bg-background lg:p-6",
          columnHeight,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The sheet itself: a bottom sheet on a phone, plain page furniture beside the
 * map on a desktop.
 *
 * Edge to edge and rounded only at the top, because a card floating with a gap
 * down both sides wastes the narrowest thing on the screen — its width — and
 * reads as a dialog that ought to be dismissable. The grab handle says which
 * way it belongs, and the bottom padding clears the home indicator.
 */
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full rounded-t-2xl border-t bg-card px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]",
        "shadow-[0_-14px_36px_-18px_rgb(15_17_21/0.45)]",
        "lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mx-auto mb-3 block h-1 w-10 rounded-full bg-border lg:hidden"
      />
      {children}
    </div>
  );
}

/** A page-sized frame for the screens that have no map: sign-in, and loading. */
export function CenteredStage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative isolate flex items-center justify-center overflow-hidden bg-asphalt px-4 py-12 text-white sm:px-6",
        STAGE_HEIGHT,
      )}
    >
      <div
        className="bg-road-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        aria-hidden="true"
      />
      <div className="absolute -top-40 end-[-10%] -z-10 size-[520px] rounded-full bg-brand/20 blur-[120px]" aria-hidden="true" />
      {children}
    </div>
  );
}

/** The map, filling its half of the stage with no frame of its own. */
export function StageMap(props: Omit<React.ComponentProps<typeof MapView>, "className">) {
  return <MapView {...props} className="size-full rounded-none border-0" />;
}

export function Notice({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
