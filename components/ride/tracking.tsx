"use client";

import { PhoneIcon, StarIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrency, formatNumber, interpolate } from "@/lib/i18n/format";
import { cancelRide, type AppConfig, type Ride } from "@/lib/ride/api";

import { QrCode } from "./qr-code";
import {
  Notice,
  Panel,
  RideMap,
  SHEET_INSET,
  Stage,
  messageFor,
  tripSummary,
  useWideLayout,
  type CommonCopy,
  type RideCopy,
} from "./shell";

type Props = {
  copy: RideCopy;
  common: CommonCopy;
  locale: Locale;
  config: AppConfig | null;
  ride: Ride;
  onUpdated: (ride: Ride) => void;
};

/**
 * The ride, while it is happening.
 *
 * Three states share this screen: waiting for a driver, one riding over, and
 * the trip itself. What changes between them is who can be called, which
 * handover code is on show, and whether the ride can still be called off.
 */
export function TrackScreen({ copy, common, locale, config, ride, onUpdated }: Props) {
  const t = copy.ride;
  const wide = useWideLayout();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waiting = ride.status === "requested";
  const riding = ride.status === "in_progress";
  /** A driver is already on their way, so calling it off is not free. */
  const feeApplies = ride.status === "accepted" || ride.status === "arriving";
  const driver = ride.driver;

  // A clock only while one is needed: the progress bar is the one thing here
  // that moves between polls.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  const maxSeconds = config?.search.maxSeconds ?? 120;
  const elapsed = Math.max(0, Math.round((now - new Date(ride.requestedAt).getTime()) / 1000));
  const progress = Math.min(100, (elapsed / maxSeconds) * 100);

  /**
   * The code the driver has to be shown: one to begin, another to close. Each
   * half disappears from the ride once it has been used, so there is nothing
   * to hide by hand.
   */
  const handover = useMemo(() => {
    if (!feeApplies && !riding) return null;
    const half = riding ? ride.handover?.finish : ride.handover?.start;
    if (!half?.code || !half.qr) return null;
    return { code: half.code, qr: half.qr, riding };
  }, [ride.handover, feeApplies, riding]);

  // Pulled apart into primitives on purpose: a poll hands back a brand-new ride
  // object every few seconds, and the pins should only be rebuilt when one of
  // these numbers has actually moved.
  const { lat: pickupLat, lng: pickupLng, address: pickupAddress } = ride.pickup;
  const { lat: dropoffLat, lng: dropoffLng, address: dropoffAddress } = ride.dropoff;
  const driverName = driver?.firstName ?? null;
  const driverLat = driver?.location?.lat ?? null;
  const driverLng = driver?.location?.lng ?? null;

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (pickupLat !== null && pickupLng !== null) {
      list.push({ id: "pickup", lat: pickupLat, lng: pickupLng, kind: "pickup", title: pickupAddress });
    }
    if (dropoffLat !== null && dropoffLng !== null) {
      list.push({ id: "dropoff", lat: dropoffLat, lng: dropoffLng, kind: "dropoff", title: dropoffAddress });
    }
    if (driverLat !== null && driverLng !== null) {
      list.push({ id: "driver", lat: driverLat, lng: driverLng, kind: "driver", title: driverName ?? undefined });
    }
    return list;
  }, [pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress, driverLat, driverLng, driverName]);

  async function doCancel() {
    setCancelling(true);
    setError(null);
    try {
      const result = await cancelRide(ride.id);
      onUpdated(result.ride);
      setConfirming(false);
    } catch (failure) {
      setError(messageFor(copy, failure));
      setConfirming(false);
    } finally {
      setCancelling(false);
    }
  }

  const headline = waiting
    ? t.searching
    : ride.status === "accepted"
      ? t.accepted
      : ride.status === "arriving"
        ? t.arriving
        : t.inProgress;
  const hint = waiting ? t.searchingHint : ride.status === "arriving" ? t.arrivingHint : null;

  // A live ride carries no fee of its own — the figure is only written once one
  // is actually charged — so the warning quotes the tariff the site publishes.
  const fee = ride.cancellationFee ?? config?.pricing.cancellationFee ?? null;
  const feeAmount = fee !== null ? formatCurrency(locale, fee, ride.fare.currency) : null;

  return (
    <Stage
      map={
        <RideMap
          label={copy.book.mapLabel}
          markers={markers}
          route={ride.route.length > 1 ? ride.route : undefined}
          sheetInset={wide ? 0 : SHEET_INSET}
        />
      }
    >
      <Panel>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-brand-deep uppercase">
              {copy.status[ride.status]}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">{headline}</h1>
            {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
          </div>

          {waiting ? (
            <div className="space-y-2">
              <Progress value={progress} aria-label={t.searching} className="h-1.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {ride.search
                    ? interpolate(t.attempt, {
                        round: formatNumber(locale, Math.max(1, ride.search.round)),
                        total: formatNumber(locale, ride.search.maxRounds),
                      })
                    : null}
                </span>
                <span dir="ltr">
                  {interpolate(t.elapsed, {
                    seconds: formatNumber(locale, Math.min(elapsed, maxSeconds)),
                    total: formatNumber(locale, maxSeconds),
                  })}
                </span>
              </div>
            </div>
          ) : null}

          {driver && !waiting ? (
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/15 text-base font-bold text-brand-deep">
                  {driver.firstName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{driver.firstName}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <StarIcon className="size-3 fill-brand text-brand" aria-hidden="true" />
                    <span>
                      {interpolate(t.driverRating, {
                        rating: formatNumber(locale, driver.rating || 5, { maximumFractionDigits: 1 }),
                      })}
                    </span>
                  </p>
                </div>
                {driver.phone ? (
                  <Button asChild variant="outline" className="h-10 shrink-0">
                    <a href={`tel:${driver.phone}`}>
                      <PhoneIcon aria-hidden="true" />
                      {t.call}
                    </a>
                  </Button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  {[driver.vehicle.brand, driver.vehicle.model, driver.vehicle.color].filter(Boolean).join(" · ")}
                </span>
                {driver.vehicle.plateNumber ? (
                  <span className="rounded-md border border-dashed px-2 py-0.5 font-mono text-sm tracking-wider" dir="ltr">
                    {driver.vehicle.plateNumber}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {handover ? <HandoverCard copy={copy} handover={handover} /> : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span dir="ltr" className="font-mono">
              {interpolate(t.code, { code: ride.code })}
            </span>
            <span>{tripSummary(copy, common, locale, ride.distanceKm, ride.durationMin)}</span>
          </div>

          <Notice message={error} />

          {!riding ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirming(true)}
              className="h-11 w-full font-semibold"
            >
              {t.cancel}
            </Button>
          ) : null}
        </div>
      </Panel>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!cancelling) setConfirming(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.cancelTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {feeApplies
                ? `${t.cancelBody} ${feeAmount ? interpolate(t.cancelFee, { amount: feeAmount }) : ""}`.trim()
                : t.cancelFree}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>{t.keepRide}</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void doCancel()} disabled={cancelling} aria-busy={cancelling}>
              {cancelling ? <Spinner aria-hidden="true" /> : null}
              {t.confirmCancel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Stage>
  );
}

/**
 * The four digits and the QR that carry them.
 *
 * Both are on screen at once on purpose: the driver either reads the number
 * out loud with an engine running beside them, or points a camera at the
 * phone. The digits are large because that is how they get read.
 */
function HandoverCard({
  copy,
  handover,
}: {
  copy: RideCopy;
  handover: { code: string; qr: string; riding: boolean };
}) {
  const t = copy.ride;
  return (
    <section className="rounded-xl border-2 border-brand bg-brand/5 p-4">
      <p className="text-sm font-semibold">{handover.riding ? t.handoverFinishTitle : t.handoverStartTitle}</p>
      <div className="mt-3 flex items-center gap-4">
        <span dir="ltr" className="flex min-w-0 flex-1 gap-1.5" aria-label={handover.code}>
          {[...handover.code].map((digit, index) => (
            <span
              key={`${index}-${digit}`}
              aria-hidden="true"
              className="flex-1 rounded-lg bg-card py-2 text-center text-3xl font-extrabold tabular-nums shadow-sm sm:text-4xl"
            >
              {digit}
            </span>
          ))}
        </span>
        <QrCode
          value={handover.qr}
          label={interpolate(t.handoverScan, { code: handover.code })}
          className="size-24 shrink-0 rounded-lg bg-white p-1 shadow-sm sm:size-28"
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {handover.riding ? t.handoverFinishHint : t.handoverStartHint}
      </p>
    </section>
  );
}
