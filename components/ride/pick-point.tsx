"use client";

import { ArrowLeftIcon, CheckIcon, ClockIcon, CrosshairIcon, MapIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Locale } from "@/lib/i18n/config";
import { describePoint, searchPlaces, type ChosenPoint, type LatLng, type Place } from "@/lib/ride/api";
import { recentPlaces } from "@/lib/ride/recent-places";
import { cn } from "@/lib/utils";

import { Notice, isAborted, messageFor, type CommonCopy, type RideCopy } from "./shell";

/** Below this a search is noise; the geocoder refuses it anyway. */
const MIN_QUERY = 3;
/** Long enough that a typed word is one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 500;
/** The pin is read back a little faster — it settles once, not per keystroke. */
const NAMING_DEBOUNCE_MS = 450;

/** What a point was called, and which point that was. */
type Named = { key: string; address: string };
type Found = { query: string; places: Place[]; error: string | null };

function keyOf(point: LatLng) {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

type Props = {
  copy: RideCopy;
  common: CommonCopy;
  locale: Locale;
  title: string;
  /** The middle of the map, reported as it settles under the pin. */
  pin: LatLng | null;
  /** Results near the rider beat results near the country. Memoised by the caller. */
  near: LatLng | null;
  locating: boolean;
  locationError: string | null;
  onLocate: () => void;
  onCancel: () => void;
  onPick: (point: ChosenPoint) => void;
  /** Which half is showing, so the sheet above can size itself to it. */
  mode: PickMode;
  onMode: (mode: PickMode) => void;
};

/** Typing an address, or aiming the map at a point. */
export type PickMode = "search" | "map";

/**
 * Choosing a point: type an address, take one used before, or read the street
 * name off the pin in the middle of the map.
 *
 * Whatever is chosen is named before it is committed — a driver is sent to an
 * address, and the rider should have seen the same words.
 *
 * Both answers are stored with the question they belong to, so "still loading"
 * is something this screen works out rather than something it has to be told.
 */
export function PickPanel({
  copy,
  common,
  locale,
  title,
  pin,
  near,
  locating,
  locationError,
  onLocate,
  onCancel,
  onPick,
  mode,
  onMode,
}: Props) {
  const t = copy.book;
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [named, setNamed] = useState<Named | null>(null);
  // Only ever mounted from a tap, long after hydration, so reading storage
  // while rendering cannot disagree with any server HTML.
  const [recents] = useState(recentPlaces);
  const confirming = useRef(false);

  const trimmed = query.trim();
  const asking = trimmed.length >= MIN_QUERY;
  const results = found?.query === trimmed ? found.places : [];
  const searchError = found?.query === trimmed ? found.error : null;
  const searching = asking && found?.query !== trimmed;

  const pinKey = pin ? keyOf(pin) : null;
  const pinLabel = named && named.key === pinKey ? named.address : null;
  const naming = pinKey !== null && pinLabel === null;

  useEffect(() => {
    if (!asking) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { places } = await searchPlaces(trimmed, near, locale, controller.signal);
        setFound({ query: trimmed, places, error: null });
      } catch (failure) {
        if (isAborted(failure)) return;
        setFound({ query: trimmed, places: [], error: messageFor(copy, failure) });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [asking, trimmed, near, locale, copy]);

  useEffect(() => {
    if (!pin || !pinKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { address } = await describePoint(pin, locale, controller.signal);
        setNamed({ key: pinKey, address });
      } catch (failure) {
        if (isAborted(failure)) return;
        // A point with no name is still a point; the coordinates will do.
        setNamed({ key: pinKey, address: `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` });
      }
    }, NAMING_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [pin, pinKey, locale]);

  async function confirmPin() {
    if (!pin || confirming.current) return;
    confirming.current = true;
    try {
      const address = pinLabel ?? (await describePoint(pin, locale)).address;
      onPick({ address, lat: pin.lat, lng: pin.lng });
    } catch {
      onPick({ address: `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`, lat: pin.lat, lng: pin.lng });
    } finally {
      confirming.current = false;
    }
  }

  const showRecents = !asking && recents.length > 0;
  const showNoResults = asking && !searching && results.length === 0 && !searchError;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} aria-label={common.back}>
          <ArrowLeftIcon className="rtl:rotate-180" />
        </Button>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>

      {/* Two ways to name a place, and they want opposite amounts of screen:
          a list of results wants height, aiming at a rooftop wants the map.
          Picking one at a time is what lets the sheet shrink out of the way. */}
      <div role="tablist" aria-label={title} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <ModeTab selected={mode === "search"} onClick={() => onMode("search")}>
          <SearchIcon className="size-4" aria-hidden="true" />
          {t.searchPlaceholder}
        </ModeTab>
        <ModeTab selected={mode === "map"} onClick={() => onMode("map")}>
          <MapIcon className="size-4" aria-hidden="true" />
          {t.pinOnMap}
        </ModeTab>
      </div>

      <div className={cn("relative", mode === "map" && "hidden")}>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="h-11 ps-9 pe-9 text-base"
        />
        {searching ? (
          <Spinner className="absolute top-1/2 end-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>

      <Notice message={searchError ?? locationError} />

      <div className={cn("max-h-56 min-h-0 overflow-y-auto lg:max-h-[34vh]", mode === "map" && "hidden")}>
        {results.length > 0 ? (
          <ul className="space-y-1">
            {results.map((place) => (
              <li key={`${place.point.lat},${place.point.lng}`}>
                <ResultRow
                  icon={<MapPinIcon className="size-4" aria-hidden="true" />}
                  label={place.label}
                  detail={place.detail}
                  onClick={() => onPick({ address: place.label, lat: place.point.lat, lng: place.point.lng })}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {showRecents ? (
          <>
            <p className="px-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.recent}</p>
            <ul className="space-y-1">
              {recents.map((place) => (
                <li key={`${place.lat},${place.lng}`}>
                  <ResultRow
                    icon={<ClockIcon className="size-4" aria-hidden="true" />}
                    label={place.address}
                    onClick={() => onPick(place)}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {showNoResults ? <p className="px-1 py-3 text-sm text-muted-foreground">{t.noResults}</p> : null}
        {!showRecents && !asking ? <p className="px-1 py-3 text-sm text-muted-foreground">{t.searchHint}</p> : null}
      </div>

      <div className={cn("rounded-xl border bg-muted/40 p-3", mode === "search" && "hidden lg:block")}>
        <p className="flex items-start gap-2 text-sm" aria-live="polite">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden="true" />
          <span className="min-w-0">
            {naming ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Spinner className="size-3.5" aria-hidden="true" />
                {t.locating}
              </span>
            ) : (
              <span className="font-medium">{pinLabel}</span>
            )}
            <span className="mt-0.5 block text-xs text-muted-foreground">{t.movePin}</span>
          </span>
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => void confirmPin()} disabled={!pin} className="h-11 flex-1 font-semibold">
            <CheckIcon aria-hidden="true" />
            {t.confirmPoint}
          </Button>
          <Button type="button" variant="outline" onClick={onLocate} disabled={locating} className="h-11">
            {locating ? <Spinner aria-hidden="true" /> : <CrosshairIcon aria-hidden="true" />}
            {t.useMyLocation}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition",
        selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ResultRow({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-start transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </button>
  );
}
