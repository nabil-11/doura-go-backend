"use client";

import { PowerIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo } from "react";

import type { MapMarker } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { DriverProfile, Earnings, LatLng, Offer } from "@/lib/drive/api";
import { DEFAULT_CENTER } from "@/lib/drive/geo";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrency, formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { OfferCard } from "./offer";
import { DriveMap, Notice, Panel, SHEET_INSET, Stage, useWideLayout, type CommonCopy, type DriveCopy } from "./shell";

/**
 * The screen a driver leaves open all day.
 *
 * One switch decides everything: online means dispatch can reach you, offline
 * means it cannot. Under it sit the two numbers that matter over a shift —
 * what you have made today, and how much of other people's cash you are
 * carrying, because the second one is what stops you working.
 *
 * An offer takes the sheet over while it lasts. It is the only thing worth
 * doing for the next thirty seconds, and the switch underneath it would only
 * be somewhere else to tap.
 */
export function HomeScreen({
  copy,
  common,
  locale,
  driver,
  position,
  earnings,
  offers,
  offerSeconds,
  busy,
  error,
  onToggle,
  onAccept,
  onDecline,
}: {
  copy: DriveCopy;
  common: CommonCopy;
  locale: Locale;
  driver: DriverProfile;
  position: LatLng | null;
  earnings: Earnings | null;
  offers: Offer[];
  offerSeconds: number;
  busy: boolean;
  error: string | null;
  onToggle: () => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const t = copy.home;
  const wide = useWideLayout();
  const online = driver.availability !== "offline";
  const offer = offers[0] ?? null;

  const balance = driver.balance;
  // The ceiling is on the cash in your pocket, not on the commission owed on it.
  const usage = balance.limit > 0 ? Math.min(1, balance.cashCollected / balance.limit) : 0;

  const lat = position?.lat ?? null;
  const lng = position?.lng ?? null;
  const markers = useMemo<MapMarker[]>(
    () => (lat !== null && lng !== null ? [{ id: "me", lat, lng, kind: "driver" }] : []),
    [lat, lng],
  );

  return (
    <Stage
      map={
        <DriveMap
          label={t.mapLabel}
          markers={markers}
          center={position ?? DEFAULT_CENTER}
          zoom={15}
          sheetInset={wide ? 0 : SHEET_INSET}
        />
      }
      overlay={
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ring-1",
            online
              ? "bg-brand text-asphalt ring-black/10"
              : "bg-card text-muted-foreground ring-black/5",
          )}
        >
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", online ? "bg-asphalt" : "bg-muted-foreground/60")}
          />
          {driver.availability === "on_trip" ? t.onTrip : online ? t.online : t.offline}
        </span>
      }
    >
      <Panel>
        {offer ? (
          <OfferCard
            key={offer.id}
            copy={copy}
            common={common}
            locale={locale}
            offer={offer}
            offerSeconds={offerSeconds}
            busy={busy}
            error={error}
            onAccept={() => onAccept(offer.id)}
            onDecline={() => onDecline(offer.id)}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {balance.blocked ? (
              <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">{t.blocked}</strong> — {t.blockedHint}
                </span>
              </p>
            ) : null}

            <Notice message={error} />

            <div>
              <p className="text-sm text-muted-foreground">{online ? t.onlineHint : t.offlineHint}</p>
              <Button
                type="button"
                onClick={onToggle}
                disabled={busy || balance.blocked || driver.availability === "on_trip"}
                variant={online ? "outline" : "default"}
                className="mt-3 h-13 w-full text-base font-semibold"
              >
                {busy ? <Spinner aria-hidden="true" /> : <PowerIcon aria-hidden="true" />}
                {online ? t.goOffline : t.goOnline}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Tile label={t.today}>
                {earnings ? (
                  <>
                    <strong className="block text-xl font-extrabold tracking-tight tabular-nums">
                      {formatCurrency(locale, earnings.today.earnings, earnings.currency)}
                    </strong>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {interpolate(copy.earnings.rides, {
                        count: formatNumber(locale, earnings.today.rides),
                      })}
                    </span>
                  </>
                ) : (
                  <Skeleton className="mt-1 h-6 w-20" />
                )}
              </Tile>

              <Tile label={t.cashHeld}>
                <strong
                  className={cn(
                    "block text-xl font-extrabold tracking-tight tabular-nums",
                    balance.blocked && "text-destructive",
                  )}
                >
                  {formatCurrency(locale, balance.cashCollected, balance.currency)}
                </strong>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {balance.limit > 0
                    ? interpolate(t.cashHeldHint, {
                        amount: formatCurrency(locale, balance.cashCollected, balance.currency),
                        limit: formatCurrency(locale, balance.limit, balance.currency),
                      })
                    : copy.earnings.noLimit}
                </span>
              </Tile>
            </div>

            {balance.limit > 0 ? <CashBar usage={usage} label={t.cashHeld} /> : null}
          </div>
        )}
      </Panel>
    </Stage>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * How full the pocket is. Amber before the limit rather than at it: a driver
 * who only finds out when the switch stops working has already lost the shift.
 */
export function CashBar({ usage, label, className }: { usage: number; label: string; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(usage * 100)}
      aria-label={label}
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-500",
          usage >= 1 ? "bg-destructive" : usage > 0.75 ? "bg-amber-500" : "bg-brand",
        )}
        style={{ inlineSize: `${usage * 100}%` }}
      />
    </div>
  );
}
