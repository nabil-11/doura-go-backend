"use client";

import { BanknoteIcon, NavigationIcon, PhoneIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MapMarker } from "@/components/map/map-view";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DriveApiError,
  arriveAtPickup,
  completeRide,
  releaseRide,
  routeBetween,
  startRide,
  type LatLng,
  type Ride,
} from "@/lib/drive/api";
import { metresBetween } from "@/lib/drive/geo";
import type { Handover } from "@/lib/domain/ride";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrency } from "@/lib/i18n/format";

import { HandoverSheet } from "./handover";
import {
  DriveMap,
  Notice,
  Panel,
  SHEET_INSET,
  Stage,
  messageFor,
  pointOf,
  useWideLayout,
  type CommonCopy,
  type DriveCopy,
} from "./shell";
import { StopsList } from "@/components/shared/stops";

/** Far enough to be worth asking for a new line along the streets. */
const REROUTE_AFTER_M = 300;

/**
 * The ride, one step at a time.
 *
 * A driver is riding a moto, so there is exactly one large button on the
 * screen and it always does the next thing: arrived, started, finished. The
 * server checks each step against the ride's real state, so a double tap or a
 * request that arrives late cannot skip ahead.
 *
 * Two of those steps are not the driver's alone to take. Starting and
 * finishing both need a code only the rider has, so the button opens the
 * handover sheet instead of firing the request, and the request goes out from
 * there with the code attached.
 */
export function ActiveRide({
  copy,
  common,
  locale,
  ride,
  position,
  onUpdated,
  onRefresh,
}: {
  copy: DriveCopy;
  common: CommonCopy;
  locale: Locale;
  ride: Ride;
  position: LatLng | null;
  onUpdated: (ride: Ride) => void;
  onRefresh: () => void;
}) {
  const t = copy.ride;
  const wide = useWideLayout();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  /** Whether the driver has asked for the code the ride is waiting on. */
  const [asked, setAsked] = useState<Handover | null>(null);

  const riding = ride.status === "in_progress";

  // Which handover this step of the ride is waiting on, if any. The sheet is
  // open only while what was asked for is still what is owed, so a ride that
  // moves on without us — a rider who cancels mid-scan — closes it by itself.
  const owed: Handover | null = ride.status === "arriving" ? "start" : riding ? "finish" : null;
  const asking = asked !== null && asked === owed ? asked : null;

  // Before the rider is aboard the driver is heading for the pickup; after,
  // for the destination. One pin, one line, whichever leg they are on.
  const heading = useMemo(
    () => (riding ? pointOf(ride.dropoff) : pointOf(ride.pickup)),
    [riding, ride.pickup, ride.dropoff],
  );

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (position) list.push({ id: "me", lat: position.lat, lng: position.lng, kind: "driver" });
    if (heading) {
      list.push({
        id: "target",
        lat: heading.lat,
        lng: heading.lng,
        kind: riding ? "dropoff" : "pickup",
        title: riding ? ride.dropoff.address : ride.pickup.address,
      });
    }
    return list;
  }, [position, heading, riding, ride.pickup.address, ride.dropoff.address]);

  // The path along the streets to wherever the driver is headed. Fetched when
  // the leg changes, and again only once they have moved a few hundred metres
  // — re-routing on every position tick would burn the routing quota without
  // telling them anything new.
  //
  // It is tagged with the leg it was fetched for, so a line that now points
  // backwards is simply not this leg's any more. Read, rather than cleared by
  // an effect that would cost a second render on every step of every ride.
  const [path, setPath] = useState<{ leg: string; points: LatLng[] } | null>(null);
  const routedFrom = useRef<{ leg: string; from: LatLng } | null>(null);
  const legPath = path && path.leg === ride.status ? path.points : null;
  const hasPath = legPath !== null;

  useEffect(() => {
    if (!position || !heading) return;
    const last = routedFrom.current;
    const moved =
      !last || last.leg !== ride.status || metresBetween(last.from, position) > REROUTE_AFTER_M;
    if (!moved && hasPath) return;

    const controller = new AbortController();
    const leg = ride.status;
    routedFrom.current = { leg, from: position };
    void routeBetween(position, heading, controller.signal)
      .then((result) => {
        if (result.route.length > 1) setPath({ leg, points: result.route });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [position, heading, ride.status, hasPath]);

  const line = useMemo(() => {
    if (legPath && legPath.length > 1) return legPath;
    return position && heading ? [position, heading] : undefined;
  }, [legPath, position, heading]);

  async function step() {
    // Arriving is the driver's word alone; the other two need the rider's.
    if (owed) return setAsked(owed);

    setBusy(true);
    setError(null);
    try {
      if (ride.status === "accepted") onUpdated((await arriveAtPickup(ride.id)).ride);
    } catch (caught) {
      setError(messageFor(copy, caught));
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const confirmHandover = useCallback(
    async (code: string) => {
      setError(null);
      try {
        const result = asking === "start" ? await startRide(ride.id, code) : await completeRide(ride.id, code);
        onUpdated(result.ride);
        setAsked(null);
      } catch (caught) {
        // A code problem is the driver's to sort out with the rider, and the
        // sheet says how. Anything else means the ride may have moved without
        // us, so it is worth asking the server where it stands.
        if (!(caught instanceof DriveApiError && caught.code.startsWith("handover"))) onRefresh();
        throw caught;
      }
    },
    [asking, onRefresh, onUpdated, ride.id],
  );

  async function release() {
    setBusy(true);
    setError(null);
    try {
      onUpdated((await releaseRide(ride.id)).ride);
    } catch (caught) {
      setError(messageFor(copy, caught));
    } finally {
      setBusy(false);
      setConfirmingRelease(false);
    }
  }

  const headline = riding ? t.riding : ride.status === "arriving" ? t.waitingRider : t.toPickup;
  const action = ride.status === "accepted" ? t.arrived : ride.status === "arriving" ? t.start : t.complete;

  return (
    <Stage
      map={
        <DriveMap
          label={t.mapLabel}
          markers={markers}
          route={line}
          sheetInset={wide ? 0 : SHEET_INSET}
        />
      }
      overlay={
        heading ? (
          <div className="flex justify-end">
            <Button asChild variant="secondary" className="h-11 shadow-md">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${heading.lat},${heading.lng}&travelmode=driving`}
                target="_blank"
                rel="noreferrer"
              >
                <NavigationIcon aria-hidden="true" />
                {t.navigate}
              </a>
            </Button>
          </div>
        ) : undefined
      }
    >
      <Panel>
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-brand-deep uppercase">
                {copy.status[ride.status]}
              </p>
              <h1 className="mt-1 truncate text-xl font-bold tracking-tight">{headline}</h1>
            </div>
            <span dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">
              {ride.code}
            </span>
          </div>

          <StopsList
            pickup={{ label: t.pickup, address: ride.pickup.address }}
            dropoff={{ label: t.dropoff, address: ride.dropoff.address }}
            pickupDone={riding}
          />

          {ride.rider ? (
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-bold text-brand-deep">
                {ride.rider.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{t.rider}</span>
                <span className="block truncate font-semibold">{ride.rider.name}</span>
              </span>
              {ride.rider.phone ? (
                <Button asChild variant="outline" size="icon" className="size-11 shrink-0">
                  <a href={`tel:${ride.rider.phone}`} aria-label={t.call} title={t.call}>
                    <PhoneIcon aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* What to collect, and what of it is actually yours. A driver who
              only sees the total hands over the wrong amount at the office. */}
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <BanknoteIcon className="size-4" aria-hidden="true" />
                {t.cash}
              </span>
              <strong className="text-2xl font-extrabold tracking-tight tabular-nums">
                {formatCurrency(locale, ride.fare.total, ride.fare.currency)}
              </strong>
            </p>
            <p className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
              <span>
                {t.yourShare}: {formatCurrency(locale, ride.fare.driverEarnings, ride.fare.currency)}
              </span>
              <span>
                {t.commission}: {formatCurrency(locale, ride.fare.commission, ride.fare.currency)}
              </span>
            </p>
          </div>

          <Notice message={error} />

          <Button
            type="button"
            onClick={() => void step()}
            disabled={busy}
            className="h-13 w-full text-base font-semibold"
          >
            {busy ? <Spinner aria-hidden="true" /> : null}
            {action}
          </Button>

          {!riding ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmingRelease(true)}
              disabled={busy}
              className="-mt-2 h-10 w-full text-sm text-muted-foreground"
            >
              {t.cancel}
            </Button>
          ) : null}
        </div>
      </Panel>

      {asking ? (
        <HandoverSheet
          copy={copy}
          common={common}
          locale={locale}
          handover={asking}
          rideId={ride.id}
          onConfirm={confirmHandover}
          onDismiss={() => setAsked(null)}
        />
      ) : null}

      <AlertDialog
        open={confirmingRelease}
        onOpenChange={(open) => {
          if (!busy) setConfirmingRelease(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.cancelTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.cancelBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.keep}</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void release()} disabled={busy} aria-busy={busy}>
              {busy ? <Spinner aria-hidden="true" /> : null}
              {t.confirmCancel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Stage>
  );
}

/** Shown once a ride is done: what to collect, then back to the road. */
export function RideFinished({
  copy,
  locale,
  ride,
  onDone,
}: {
  copy: DriveCopy;
  locale: Locale;
  ride: Ride;
  onDone: () => void;
}) {
  const t = copy.ride;
  return (
    <div className="flex h-full flex-col items-center justify-center bg-asphalt px-6 py-12 text-center text-white">
      <span className="grid size-16 place-items-center rounded-full bg-brand text-asphalt">
        <BanknoteIcon className="size-8" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">{t.finished}</h1>
      <p className="mt-2 text-lg text-white/80">
        {formatCurrency(locale, ride.fare.total, ride.fare.currency)}
      </p>
      <p className="mt-1 text-sm text-white/55">{t.cash}</p>

      <dl className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <dt className="text-xs text-white/55">{t.yourShare}</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums">
            {formatCurrency(locale, ride.fare.driverEarnings, ride.fare.currency)}
          </dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <dt className="text-xs text-white/55">{t.commission}</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums">
            {formatCurrency(locale, ride.fare.commission, ride.fare.currency)}
          </dd>
        </div>
      </dl>

      <Button onClick={onDone} className="mt-8 h-13 w-full max-w-sm text-base font-semibold">
        {t.done}
      </Button>
    </div>
  );
}
