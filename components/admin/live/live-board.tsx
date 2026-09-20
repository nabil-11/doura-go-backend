"use client";

import { MotorbikeIcon, RefreshCwIcon, SignalZeroIcon, TimerIcon, UserCheckIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { MapView, type MapMarker } from "@/components/map/map-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cityName } from "@/lib/config/site";
import { formatNumber, formatPhone, formatTime, interpolate } from "@/lib/i18n/format";
import type { LiveSnapshot } from "@/lib/services/live";
import { cn } from "@/lib/utils";

const REFRESH_MS = 10_000;

/**
 * The operations map. It polls a small snapshot endpoint rather than holding a
 * socket open — serverless has nowhere to keep one — and pauses while the tab
 * is in the background, so an open dashboard costs nothing overnight.
 *
 * The tables underneath are not a fallback: they are how you read a position
 * that a pin can't give you, and they work with a screen reader.
 */
export function LiveBoard({ initial }: { initial: LiveSnapshot }) {
  const dict = useDictionary();
  const locale = useLocale();
  const t = dict.admin.live;

  const [snapshot, setSnapshot] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/live", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setSnapshot((await response.json()) as LiveSnapshot);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const waiting = snapshot.rides.filter((ride) => ride.status === "requested");

  const markers: MapMarker[] = [
    ...snapshot.drivers.map((driver): MapMarker => ({
      id: `driver-${driver.id}`,
      lat: driver.location.lat,
      lng: driver.location.lng,
      kind: driver.stale ? "place" : driver.availability === "on_trip" ? "driver-busy" : "driver",
      title: driver.name,
      meta: [
        driver.plateNumber,
        driver.stale ? t.stale : driver.availability === "on_trip" ? t.onTrip : t.online,
        driver.lastSeenAt ? formatTime(locale, driver.lastSeenAt) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    ...waiting.flatMap((ride): MapMarker[] =>
      ride.pickupPoint
        ? [{
            id: `ride-${ride.id}`,
            lat: ride.pickupPoint.lat,
            lng: ride.pickupPoint.lng,
            kind: "pickup",
            title: ride.code,
            meta: `${ride.pickup} · ${waitLabel(ride.waitingSeconds, locale, dict)}`,
          }]
        : [],
    ),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Count icon={UserCheckIcon} tone="good" label={t.online} value={snapshot.counts.online} locale={locale} />
        <Count icon={MotorbikeIcon} tone="info" label={t.onTrip} value={snapshot.counts.onTrip} locale={locale} />
        <Count
          icon={SignalZeroIcon}
          tone="warning"
          label={t.stale}
          value={snapshot.counts.stale}
          locale={locale}
          title={t.staleHint}
        />
        <Count icon={TimerIcon} tone="brand" label={t.waiting} value={snapshot.counts.waiting} locale={locale} />

        <div className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
          {failed ? <span className="text-status-critical">{t.failed}</span> : null}
          <span className="ltr-nums">{interpolate(t.updated, { time: formatTime(locale, snapshot.at) })}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-medium transition-colors hover:bg-accent"
          >
            {refreshing ? <Spinner className="size-3.5" /> : <RefreshCwIcon className="size-3.5" aria-hidden="true" />}
            {t.refresh}
          </button>
        </div>
      </div>

      <MapView
        markers={markers}
        scrollZoom
        className="h-[clamp(20rem,58vh,36rem)]"
        label={t.mapLabel}
        center={{ lat: 36.8065, lng: 10.1815 }}
      />

      <Tabs defaultValue="drivers">
        <TabsList>
          <TabsTrigger value="drivers">
            {t.driversTab}
            <span className="tabular ms-1.5 text-muted-foreground">{formatNumber(locale, snapshot.drivers.length)}</span>
          </TabsTrigger>
          <TabsTrigger value="rides">
            {t.ridesTab}
            <span className="tabular ms-1.5 text-muted-foreground">{formatNumber(locale, waiting.length)}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drivers">
          <Card className="overflow-hidden p-0">
            {snapshot.drivers.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.driver}</TableHead>
                    <TableHead>{t.vehicle}</TableHead>
                    <TableHead>{dict.admin.drivers.table.city}</TableHead>
                    <TableHead>{t.state}</TableHead>
                    <TableHead className="text-end">{t.lastSeen}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <Link href={`/${locale}/admin/drivers/${driver.id}`} className="font-medium hover:underline">
                          {driver.name}
                        </Link>
                        <p className="ltr-nums text-xs text-muted-foreground">{formatPhone(driver.phone)}</p>
                      </TableCell>
                      <TableCell dir="ltr" className="font-mono text-xs">{driver.plateNumber ?? "—"}</TableCell>
                      <TableCell>{cityName(driver.city, locale)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5",
                            driver.stale
                              ? "border-status-warning/40 text-status-warning"
                              : driver.availability === "on_trip"
                                ? "border-[#2a78d6]/40 text-[#1c5cab] dark:text-[#9ec5f4]"
                                : "border-status-good/40 text-status-good",
                          )}
                          title={driver.stale ? t.staleHint : undefined}
                        >
                          {driver.stale ? (
                            <SignalZeroIcon className="size-3" aria-hidden="true" />
                          ) : driver.availability === "on_trip" ? (
                            <MotorbikeIcon className="size-3" aria-hidden="true" />
                          ) : (
                            <UserCheckIcon className="size-3" aria-hidden="true" />
                          )}
                          {driver.stale ? t.stale : driver.availability === "on_trip" ? t.onTrip : t.online}
                        </Badge>
                      </TableCell>
                      <TableCell className="ltr-nums text-end text-muted-foreground">
                        {driver.lastSeenAt ? formatTime(locale, driver.lastSeenAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty title={t.noDrivers} hint={t.noDriversHint} />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="rides">
          <Card className="overflow-hidden p-0">
            {waiting.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.ride}</TableHead>
                    <TableHead>{t.pickup}</TableHead>
                    <TableHead>{dict.admin.drivers.table.city}</TableHead>
                    <TableHead className="text-end">{t.waitingFor}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waiting.map((ride) => (
                    <TableRow key={ride.id}>
                      <TableCell>
                        <Link
                          href={`/${locale}/admin/rides/${ride.id}`}
                          dir="ltr"
                          className="font-mono text-xs font-medium hover:underline"
                        >
                          {ride.code}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{ride.pickup}</TableCell>
                      <TableCell>{cityName(ride.city, locale)}</TableCell>
                      <TableCell className="tabular text-end">
                        {waitLabel(ride.waitingSeconds, locale, dict)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty title={t.noRides} />
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function waitLabel(seconds: number, locale: ReturnType<typeof useLocale>, dict: ReturnType<typeof useDictionary>) {
  return seconds < 60
    ? interpolate(dict.common.secondsShort, { count: formatNumber(locale, seconds) })
    : interpolate(dict.common.minutesShort, { count: formatNumber(locale, Math.round(seconds / 60)) });
}

const tones = {
  good: "text-status-good",
  info: "text-[#1c5cab] dark:text-[#9ec5f4]",
  warning: "text-status-warning",
  brand: "text-brand-deep dark:text-brand",
} as const;

function Count({
  icon: Icon,
  tone,
  label,
  value,
  locale,
  title,
}: {
  icon: typeof MotorbikeIcon;
  tone: keyof typeof tones;
  label: string;
  value: number;
  locale: ReturnType<typeof useLocale>;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm"
    >
      <Icon className={cn("size-4", tones[tone])} aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-semibold">{formatNumber(locale, value)}</span>
    </span>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <CardContent className="py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </CardContent>
  );
}
