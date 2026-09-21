"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { Offer } from "@/lib/drive/api";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrency, formatNumber, interpolate } from "@/lib/i18n/format";

import { StopsList } from "@/components/shared/stops";
import { Notice, tripLine, type CommonCopy, type DriveCopy } from "./shell";

function secondsLeft(expiresAt: string | null) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/**
 * An incoming ride, with the two numbers a driver decides on: how far away the
 * pickup is, and what the trip pays. The bar runs the time down — the same
 * offer is on several screens at once, and the first to accept keeps it.
 */
export function OfferCard({
  copy,
  common,
  locale,
  offer,
  offerSeconds,
  busy,
  error,
  onAccept,
  onDecline,
}: {
  copy: DriveCopy;
  common: CommonCopy;
  locale: Locale;
  offer: Offer;
  /** The full length of an offer, so the bar starts full rather than part-used. */
  offerSeconds: number;
  busy: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = copy.offer;
  const [left, setLeft] = useState(() => secondsLeft(offer.expiresAt));

  // Mounted per offer — see the key on <OfferCard> — so the initial state
  // above is already this offer's, and the timer only has to keep it moving.
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(secondsLeft(offer.expiresAt)), 500);
    return () => window.clearInterval(timer);
  }, [offer.expiresAt]);

  const total = Math.max(1, offerSeconds);
  const away =
    offer.pickupDistanceKm === null
      ? copy.ride.pickup
      : interpolate(t.pickupAway, {
          distance: interpolate(common.kilometersShort, {
            count: formatNumber(locale, offer.pickupDistanceKm, { maximumFractionDigits: 1 }),
          }),
        });

  return (
    <section
      className="rounded-2xl border-2 border-brand bg-card p-4 shadow-lg"
      role="alertdialog"
      aria-label={t.title}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-brand-deep uppercase">{t.title}</p>
        <span dir="ltr" className="text-sm font-semibold tabular-nums text-muted-foreground">
          {interpolate(t.expiresIn, { seconds: formatNumber(locale, left) })}
        </span>
      </div>

      <Progress
        value={(left / total) * 100}
        aria-label={t.title}
        className="mt-2 h-1.5"
      />

      {/* What it pays, first and biggest: it is the decision. */}
      <p className="mt-4 flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{t.earn}</span>
        <strong className="text-3xl font-extrabold tracking-tight tabular-nums">
          {formatCurrency(locale, offer.earnings, offer.currency)}
        </strong>
      </p>

      <StopsList
        className="mt-4"
        pickup={{ label: away, address: offer.pickup.address }}
        dropoff={{
          label: `${t.trip} · ${tripLine(common, locale, offer.distanceKm, offer.durationMin)}`,
          address: offer.dropoff.address,
        }}
      />

      <Notice message={error} className="mt-3" />

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDecline}
          disabled={busy}
          className="h-12 flex-1 font-semibold"
        >
          {t.decline}
        </Button>
        <Button
          type="button"
          onClick={onAccept}
          disabled={busy || left <= 0}
          className="h-12 flex-[1.6] text-base font-semibold"
        >
          {busy ? <Spinner aria-hidden="true" /> : null}
          {t.accept}
        </Button>
      </div>
    </section>
  );
}
