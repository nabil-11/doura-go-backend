import { CircleDotIcon, MapPinIcon, SquareIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/admin/access-denied";
import { BackLink } from "@/components/admin/page-header";
import { RideStatusBadge } from "@/components/admin/status-badge";
import { MapView } from "@/components/map/map-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { cityName } from "@/lib/config/site";
import { formatCurrency, formatDateTime, formatNumber, formatPhone, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { getRide } from "@/lib/services/rides";

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/rides/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [dict, ride] = await Promise.all([getDictionary(), getRide(id)]);
  return { title: ride ? interpolate(dict.admin.rides.detail.title, { code: ride.code }) : dict.admin.rides.title };
}

export default async function RidePage({ params }: PageProps<"/[lang]/admin/rides/[id]">) {
  const { id } = await params;
  const [admin, dict, locale] = await Promise.all([requireAdmin(), getDictionary(), getLocale()]);
  if (!can(admin.role, "rides:view")) return <AccessDenied dict={dict} />;

  const ride = await getRide(id);
  if (!ride) notFound();

  const t = dict.admin.rides.detail;
  const money = (value: number) => formatCurrency(locale, value, ride.fare.currency);
  const cancelledBy = ride.cancelledBy
    ? { rider: t.cancelledByRider, driver: t.cancelledByDriver, system: t.cancelledBySystem }[ride.cancelledBy]
    : null;

  const timeline = [
    { label: t.requestedAt, at: ride.requestedAt },
    { label: t.acceptedAt, at: ride.acceptedAt },
    { label: t.startedAt, at: ride.startedAt },
    { label: t.completedAt, at: ride.completedAt },
    { label: t.cancelledAt, at: ride.cancelledAt },
  ].filter((step): step is { label: string; at: Date } => step.at instanceof Date);

  return (
    <div className="space-y-6">
      <BackLink href={`/${locale}/admin/rides`} label={t.back} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {interpolate(t.title, { code: "" })}
          <span dir="ltr" className="font-mono">
            {ride.code}
          </span>
        </h1>
        <RideStatusBadge status={ride.status} label={dict.admin.statuses.ride[ride.status]} />
        <span className="text-sm text-muted-foreground">
          {cityName(ride.city, locale)} · {formatDateTime(locale, ride.requestedAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.route}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-6 before:absolute before:inset-y-2 before:start-[11px] before:border-s-2 before:border-dashed before:border-border">
                <li className="relative flex gap-3">
                  <CircleDotIcon className="relative size-6 shrink-0 bg-card text-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.pickup}</p>
                    <p className="font-medium">{ride.pickup}</p>
                  </div>
                </li>
                <li className="relative flex gap-3">
                  <SquareIcon className="relative size-6 shrink-0 bg-card fill-foreground p-1 text-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.dropoff}</p>
                    <p className="font-medium">{ride.dropoff}</p>
                  </div>
                </li>
              </ol>
              <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPinIcon className="size-4" aria-hidden="true" />
                {interpolate(dict.common.kilometersShort, { count: formatNumber(locale, ride.distanceKm, { maximumFractionDigits: 1 }) })} ·{" "}
                {interpolate(dict.common.minutesShort, { count: formatNumber(locale, ride.durationMin) })}
              </p>

              {ride.pickupPoint && ride.dropoffPoint ? (
                <MapView
                  className="mt-5 h-72"
                  label={t.map}
                  markers={[
                    { id: "pickup", kind: "pickup", title: t.pickup, meta: ride.pickup, ...ride.pickupPoint },
                    { id: "dropoff", kind: "dropoff", title: t.dropoff, meta: ride.dropoff, ...ride.dropoffPoint },
                  ]}
                  route={ride.route.length ? ride.route : [ride.pickupPoint, ride.dropoffPoint]}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.timeline}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {timeline.map((step) => (
                  <li key={step.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-medium">{formatDateTime(locale, step.at)}</span>
                  </li>
                ))}
              </ul>
              {cancelledBy ? (
                <p className="mt-4 rounded-lg bg-status-critical/10 px-3 py-2 text-sm">
                  {interpolate(t.cancelledBy, { who: cancelledBy })}
                  {ride.cancellationReason ? ` — ${ride.cancellationReason}` : ""}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.fare}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {/* A flat short-ride fare has no parts to break down; showing
                  rows of zero would only invite the question. */}
              {ride.fare.flat ? (
                <Row label={dict.admin.pricing.shortRideFlat} value={money(ride.fare.total)} />
              ) : (
                <>
                  <Row label={t.base} value={money(ride.fare.base)} />
                  <Row
                    label={interpolate(t.distance, {
                      value: interpolate(dict.common.kilometersShort, { count: formatNumber(locale, ride.distanceKm, { maximumFractionDigits: 1 }) }),
                    })}
                    value={money(ride.fare.distance)}
                  />
                  <Row
                    label={interpolate(t.time, { value: interpolate(dict.common.minutesShort, { count: formatNumber(locale, ride.durationMin) }) })}
                    value={money(ride.fare.time)}
                  />
                  <Row label={t.bookingFee} value={money(ride.fare.bookingFee)} />
                </>
              )}
              <Separator />
              <Row label={t.total} value={money(ride.fare.total)} strong />
              <Row label={t.commission} value={money(ride.fare.commission)} muted />
              <Row label={t.driverEarnings} value={money(ride.fare.driverEarnings)} muted />
              <Separator />
              <Row label={t.payment} value={dict.admin.rides.payment[ride.paymentMethod]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.people}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t.rider}</p>
                {ride.rider ? (
                  <Link href={`/${locale}/admin/riders/${ride.rider.id}`} className="font-medium hover:underline">
                    {ride.rider.name}
                  </Link>
                ) : (
                  <p className="font-medium">—</p>
                )}
                {ride.riderPhone ? <p className="ltr-nums text-muted-foreground">{formatPhone(ride.riderPhone)}</p> : null}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.driver}</p>
                {ride.driver ? (
                  <Link href={`/${locale}/admin/drivers/${ride.driver.id}`} className="font-medium hover:underline">
                    {ride.driver.name}
                  </Link>
                ) : (
                  <p className="text-muted-foreground">{dict.admin.rides.unassigned}</p>
                )}
                {ride.driverPhone ? <p className="ltr-nums text-muted-foreground">{formatPhone(ride.driverPhone)}</p> : null}
              </div>
              {ride.riderRating ? (
                <div>
                  <p className="text-xs text-muted-foreground">{t.rating}</p>
                  <p className="inline-flex items-center gap-1 font-medium">
                    <StarIcon className="size-4 fill-brand text-brand" aria-hidden="true" />
                    {ride.riderRating}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={muted ? "text-muted-foreground" : undefined}>{label}</span>
      <span className={`tabular ${strong ? "text-base font-semibold" : muted ? "text-muted-foreground" : "font-medium"}`}>{value}</span>
    </div>
  );
}
