"use client";

import { BanknoteIcon, CircleCheckBigIcon, CircleXIcon, RepeatIcon, StarIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { MapMarker } from "@/components/map/map-view";
import { StopsList } from "@/components/shared/stops";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrency, interpolate } from "@/lib/i18n/format";
import { rateRide, type Ride } from "@/lib/ride/api";

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

const STARS = [1, 2, 3, 4, 5] as const;

type Props = {
  copy: RideCopy;
  common: CommonCopy;
  locale: Locale;
  ride: Ride;
  /** Leaving this screen. `again` carries the same two stops back to booking. */
  onDone: (again: boolean) => void;
};

/** How a ride ended, and — when it ended well — what the rider made of it. */
export function OutcomeScreen({ copy, common, locale, ride, onDone }: Props) {
  const t = copy.ride;
  const wide = useWideLayout();
  const completed = ride.status === "completed";
  const rateable = completed && ride.riderRating === null;
  const [rating, setRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (ride.pickup.lat !== null && ride.pickup.lng !== null) {
      list.push({ id: "pickup", lat: ride.pickup.lat, lng: ride.pickup.lng, kind: "pickup", title: ride.pickup.address });
    }
    if (ride.dropoff.lat !== null && ride.dropoff.lng !== null) {
      list.push({ id: "dropoff", lat: ride.dropoff.lat, lng: ride.dropoff.lng, kind: "dropoff", title: ride.dropoff.address });
    }
    return list;
  }, [ride.pickup, ride.dropoff]);

  const lead =
    ride.cancelledBy === "system"
      ? t.cancelledBySystem
      : ride.cancelledBy === "driver"
        ? t.cancelledByDriver
        : null;

  async function submit() {
    if (!rating || sending) return;
    setSending(true);
    setError(null);
    try {
      await rateRide(ride.id, rating);
      onDone(false);
    } catch (failure) {
      setError(messageFor(copy, failure));
      setSending(false);
    }
  }

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
          <div className="flex items-center gap-3">
            <span
              className={
                completed
                  ? "grid size-11 shrink-0 place-items-center rounded-full bg-status-good/15 text-status-good"
                  : "grid size-11 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"
              }
            >
              {completed ? (
                <CircleCheckBigIcon className="size-6" aria-hidden="true" />
              ) : (
                <CircleXIcon className="size-6" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">{completed ? t.completed : t.cancelled}</h1>
              <p className="text-sm text-muted-foreground">
                {tripSummary(copy, common, locale, ride.distanceKm, ride.durationMin)}
              </p>
            </div>
          </div>

          {lead ? <p className="text-sm text-muted-foreground">{lead}</p> : null}

          {/* Which trip this was. "Order the same trip" below is a promise
              about two particular addresses, and a rider should be able to
              read them before taking it — a cancelled ride otherwise leaves
              nothing on screen but a distance. */}
          <StopsList
            className="rounded-xl border bg-muted/40 p-3"
            pickup={{ label: copy.book.pickup, address: ride.pickup.address }}
            dropoff={{ label: copy.book.dropoff, address: ride.dropoff.address }}
          />

          {completed ? (
            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t.total}</span>
                <span className="text-2xl font-extrabold tracking-tight">
                  {formatCurrency(locale, ride.fare.total, ride.fare.currency)}
                </span>
              </div>
              <p className="mt-3 flex items-center gap-2 border-t pt-3 text-sm">
                <BanknoteIcon className="size-4 shrink-0 text-status-good" aria-hidden="true" />
                {t.payWith}
              </p>
            </div>
          ) : ride.cancellationFee && ride.cancelledBy === "rider" ? (
            <div className="flex items-baseline justify-between gap-3 rounded-xl border bg-muted/40 p-4">
              <span className="text-sm text-muted-foreground">{t.fee}</span>
              <span className="text-lg font-bold">
                {formatCurrency(locale, ride.cancellationFee, ride.fare.currency)}
              </span>
            </div>
          ) : null}

          {rateable ? (
            <div>
              <h2 className="font-semibold">{t.rateTitle}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t.rateSubtitle}</p>
              <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label={t.rateTitle}>
                {STARS.map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={interpolate(t.rateValue, { count: star })}
                    onClick={() => setRating(star)}
                    className="rounded-lg p-1.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <StarIcon
                      className={
                        star <= rating ? "size-8 fill-brand text-brand" : "size-8 text-muted-foreground/40"
                      }
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {completed && !rateable ? (
            <p className="text-sm text-muted-foreground">{t.rateThanks}</p>
          ) : null}

          <Notice message={error} />

          {/* A rating is the only thing that outranks leaving, and only while
              it is still owed. Once it is not, this screen is a dead end with
              one way out — so that way out gets the whole width, the height of
              a primary action and a word about what it will actually do. */}
          {rateable ? (
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={!rating || sending}
                className="h-12 flex-1 text-base font-semibold"
              >
                {sending ? <Spinner aria-hidden="true" /> : null}
                {t.rateSubmit}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onDone(false)}
                disabled={sending}
                className="h-12 flex-1 text-base font-semibold"
              >
                {t.rateSkip}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                onClick={() => onDone(true)}
                className="h-13 w-full text-base font-semibold shadow-sm transition-shadow hover:shadow-md"
              >
                <RepeatIcon aria-hidden="true" />
                {t.bookAgain}
              </Button>
              {/* The same trip failing is exactly when a rider might want a
                  different one; an empty booking screen is one tap away and
                  should not be the only thing this button can mean. */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onDone(false)}
                className="h-10 w-full text-sm font-medium text-muted-foreground"
              >
                {t.bookOther}
              </Button>
            </div>
          )}
        </div>
      </Panel>
    </Stage>
  );
}
