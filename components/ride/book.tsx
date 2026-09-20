"use client";

import { BanknoteIcon, CrosshairIcon, FlagIcon, LogOutIcon, MapPinIcon, TagIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MapMarker } from "@/components/map/map-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrency, interpolate } from "@/lib/i18n/format";
import {
  RideApiError,
  describePoint,
  estimateRide,
  requestRide,
  type AppConfig,
  type ChosenPoint,
  type LatLng,
  type Ride,
  type RideEstimate,
  type RiderProfile,
} from "@/lib/ride/api";
import { rememberPlace } from "@/lib/ride/recent-places";

import { PickPanel } from "./pick-point";
import {
  Notice,
  Panel,
  RideMap,
  SHEET_INSET,
  Stage,
  isAborted,
  messageFor,
  tripSummary,
  useWideLayout,
  type CommonCopy,
  type RideCopy,
} from "./shell";

/** Where the map opens before anything is known: the middle of Tunis. */
const FALLBACK_CENTRE: LatLng = { lat: 36.8065, lng: 10.1815 };

/** Two points this close together are the same doorway, not a trip. */
const SAME_POINT = 0.0004;

type Stop = "pickup" | "dropoff";

/** A fare, tied to the pair of pins it was worked out for. */
type Priced = { trip: string; estimate: RideEstimate | null; error: string | null };

function keyOf(point: LatLng) {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

/**
 * Two positions, in order: the quick, accurate one first, then a slower and
 * coarser one for a phone indoors. Both failing means there is no position to
 * be had and the rider sets the pickup by hand.
 */
function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    const found = (position: GeolocationPosition) =>
      resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
    navigator.geolocation.getCurrentPosition(found, () => {
      navigator.geolocation.getCurrentPosition(found, reject, {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 120_000,
      });
    }, { enableHighAccuracy: true, timeout: 6_000, maximumAge: 15_000 });
  });
}

type Props = {
  copy: RideCopy;
  common: CommonCopy;
  locale: Locale;
  config: AppConfig | null;
  rider: RiderProfile;
  onRequested: (ride: Ride) => void;
  /** Called when the server knows about a ride this screen doesn't. */
  onRecheck: () => void;
  onSignOut: () => void;
};

export function BookScreen({ copy, common, locale, config, rider, onRequested, onRecheck, onSignOut }: Props) {
  const t = copy.book;
  const wide = useWideLayout();

  const [pickup, setPickup] = useState<ChosenPoint | null>(null);
  const [dropoff, setDropoff] = useState<ChosenPoint | null>(null);
  const [picking, setPicking] = useState<Stop | null>(null);
  /** Where the picker's map opens, and the counter that remounts it there. */
  const [seed, setSeed] = useState<LatLng | null>(null);
  const [seedRound, setSeedRound] = useState(0);
  /** The middle of the map while the pin is being dragged. */
  const [pin, setPin] = useState<LatLng | null>(null);

  /** The last answer, kept with the question it answers. */
  const [priced, setPriced] = useState<Priced | null>(null);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const centre = config?.cities.find((city) => city.bookable)?.center ?? FALLBACK_CENTRE;
  const sameStops =
    !!pickup &&
    !!dropoff &&
    Math.abs(pickup.lat - dropoff.lat) <= SAME_POINT &&
    Math.abs(pickup.lng - dropoff.lng) <= SAME_POINT;

  /** Search results near the rider beat results near the country. */
  const near = useMemo(() => (pickup ? { lat: pickup.lat, lng: pickup.lng } : null), [pickup]);

  // The trip as a single value: while it differs from what was last priced,
  // the fare on screen belongs to a different pair of pins and is not shown.
  const trip = pickup && dropoff && !sameStops ? `${keyOf(pickup)}|${keyOf(dropoff)}` : null;
  const estimate = priced?.trip === trip ? priced.estimate : null;
  const estimateError = priced?.trip === trip ? priced.error : null;
  const estimating = trip !== null && priced?.trip !== trip;

  /** Finds a position and names it. Leaves the spinner to whoever asked. */
  const findMe = useCallback(async (): Promise<ChosenPoint | null> => {
    try {
      const point = await currentPosition();
      const { address } = await describePoint(point, locale);
      setLocationError(null);
      return { address, lat: point.lat, lng: point.lng };
    } catch (failure) {
      setLocationError(
        failure instanceof Error && failure.message === "unsupported"
          ? t.locationUnsupported
          : t.locationDenied,
      );
      return null;
    } finally {
      setLocating(false);
    }
  }, [locale, t.locationDenied, t.locationUnsupported]);

  // The phone's own position is the pickup nine times out of ten, so it is
  // offered without being asked for — quietly, with no spinner for something
  // nobody requested.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void findMe().then((found) => {
      if (found) setPickup((current) => current ?? found);
    });
  }, [findMe]);

  // Nothing is written by an estimate, so it can follow the pins freely; each
  // new pair cancels the answer to the last one.
  useEffect(() => {
    if (!trip || !pickup || !dropoff) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const result = await estimateRide(pickup, dropoff, controller.signal);
        setPriced({ trip, estimate: result.estimate, error: null });
      } catch (failure) {
        if (isAborted(failure)) return;
        setPriced({ trip, estimate: null, error: messageFor(copy, failure) });
      }
    })();
    return () => controller.abort();
  }, [trip, pickup, dropoff, copy]);

  function startPicking(stop: Stop) {
    // The dropoff picker opens over the pickup the first time: a destination is
    // almost always near where the rider is standing, not in the next city.
    const start = (stop === "pickup" ? pickup : (dropoff ?? pickup)) ?? centre;
    setSeed({ lat: start.lat, lng: start.lng });
    setPin({ lat: start.lat, lng: start.lng });
    setSeedRound((round) => round + 1);
    setLocationError(null);
    setPicking(stop);
  }

  function choose(point: ChosenPoint) {
    if (picking === "dropoff") setDropoff(point);
    else setPickup(point);
    setPicking(null);
    setRequestError(null);
  }

  /** "My position", from the book panel: it becomes the pickup. */
  function locateForPickup() {
    setLocating(true);
    void findMe().then((found) => {
      if (found) setPickup(found);
    });
  }

  /** "My position", from the picker: the map moves there and the pin follows. */
  function locateForPin() {
    setLocating(true);
    void findMe().then((found) => {
      if (!found) return;
      setSeed({ lat: found.lat, lng: found.lng });
      setPin({ lat: found.lat, lng: found.lng });
      setSeedRound((round) => round + 1);
    });
  }

  async function request() {
    if (!pickup || !dropoff || !estimate || requesting) return;
    setRequesting(true);
    setRequestError(null);
    try {
      const { ride } = await requestRide(pickup, dropoff);
      rememberPlace(dropoff);
      onRequested(ride);
    } catch (failure) {
      setRequestError(messageFor(copy, failure));
      // A ride already under way is not a failure to retry — this screen is out
      // of date, and the one that is running is the one to go back to.
      if (failure instanceof RideApiError && failure.code === "rideInProgress") onRecheck();
    } finally {
      setRequesting(false);
    }
  }

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (pickup) list.push({ id: "pickup", lat: pickup.lat, lng: pickup.lng, kind: "pickup", title: pickup.address });
    if (dropoff) list.push({ id: "dropoff", lat: dropoff.lat, lng: dropoff.lng, kind: "dropoff", title: dropoff.address });
    return list;
  }, [pickup, dropoff]);

  const line = useMemo(() => {
    if (estimate?.route.length) return estimate.route;
    if (pickup && dropoff) return [pickup, dropoff].map((stop) => ({ lat: stop.lat, lng: stop.lng }));
    return undefined;
  }, [estimate, pickup, dropoff]);

  const bookableCities = (config?.cities ?? [])
    .filter((city) => city.bookable)
    .map((city) => city.name[locale] ?? city.name.fr ?? city.id);

  const map = picking ? (
    <RideMap
      key={`pick-${picking}-${seedRound}`}
      label={t.pickerMapLabel}
      markers={[]}
      center={seed ?? centre}
      zoom={16}
      scrollZoom
      picking
      onPick={setPin}
    />
  ) : (
    <RideMap
      key="view"
      label={t.mapLabel}
      markers={markers}
      route={line}
      center={centre}
      sheetInset={wide ? 0 : SHEET_INSET}
    />
  );

  return (
    <Stage map={map}>
      <Panel>
        {picking ? (
          <PickPanel
            copy={copy}
            common={common}
            locale={locale}
            title={picking === "pickup" ? t.setPickup : t.setDropoff}
            pin={pin}
            near={near}
            locating={locating}
            locationError={locationError}
            onLocate={locateForPin}
            onCancel={() => setPicking(null)}
            onPick={choose}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-tight">{t.greeting}</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {interpolate(copy.signedInAs, { name: rider.name })}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={onSignOut} className="-me-1 shrink-0">
                <LogOutIcon className="rtl:rotate-180" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{copy.signOut}</span>
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <StopRow
                icon={<MapPinIcon className="size-4" aria-hidden="true" />}
                label={t.pickup}
                value={pickup?.address}
                placeholder={t.pickupPlaceholder}
                onClick={() => startPicking("pickup")}
              />
              <div className="h-px bg-border" />
              <StopRow
                icon={<FlagIcon className="size-4" aria-hidden="true" />}
                label={t.dropoff}
                value={dropoff?.address}
                placeholder={t.dropoffPlaceholder}
                onClick={() => startPicking("dropoff")}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={locateForPickup}
              disabled={locating}
              className="h-10 w-fit"
            >
              {locating ? <Spinner aria-hidden="true" /> : <CrosshairIcon aria-hidden="true" />}
              {locating ? t.locating : t.useMyLocation}
            </Button>

            <Notice message={locationError} />
            {sameStops ? <Notice message={t.sameStops} /> : null}
            <Notice message={estimateError ?? requestError} />

            {estimating ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" aria-hidden="true" />
                {t.pricing}
              </p>
            ) : null}

            {estimate ? (
              <div className="rounded-xl border bg-muted/40 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{t.fare}</span>
                  <span className="text-2xl font-extrabold tracking-tight">
                    {formatCurrency(locale, estimate.fare.total, estimate.fare.currency)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tripSummary(copy, common, locale, estimate.distanceKm, estimate.durationMin)}
                </p>
                {estimate.fare.flat ? (
                  <Badge variant="secondary" className="mt-3 h-auto py-1">
                    <TagIcon aria-hidden="true" />
                    {t.flatFare}
                  </Badge>
                ) : null}
                <p className="mt-3 flex items-start gap-2 border-t pt-3 text-sm">
                  <BanknoteIcon className="mt-0.5 size-4 shrink-0 text-status-good" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{t.payCash}</span>
                    <span className="block text-xs text-muted-foreground">{t.payCashHint}</span>
                  </span>
                </p>
              </div>
            ) : null}

            <Button
              type="button"
              onClick={() => void request()}
              disabled={!estimate || estimating || requesting}
              className="h-12 w-full text-base font-semibold"
            >
              {requesting ? <Spinner aria-hidden="true" /> : null}
              {requesting ? t.requesting : t.request}
            </Button>

            {bookableCities.length > 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                {interpolate(t.cities, { cities: bookableCities.join(" · ") })}
              </p>
            ) : null}
          </div>
        )}
      </Panel>
    </Stage>
  );
}

function StopRow({
  icon,
  label,
  value,
  placeholder,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  placeholder: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-3 text-start transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      <span className="text-brand-deep">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className={value ? "block truncate text-sm font-medium" : "block truncate text-sm text-muted-foreground"}>
          {value ?? placeholder}
        </span>
      </span>
    </button>
  );
}
