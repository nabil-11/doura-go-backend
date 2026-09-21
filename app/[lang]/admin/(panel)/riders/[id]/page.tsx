import { BanIcon, MailIcon, PhoneIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/admin/access-denied";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { BackLink } from "@/components/admin/page-header";
import { RecentRides } from "@/components/admin/recent-rides";
import { RiderActions } from "@/components/admin/riders/rider-actions";
import { RiderStatusBadge } from "@/components/admin/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPhone,
  initials,
  interpolate,
} from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { getRider } from "@/lib/services/riders";
import { listActivityFor } from "@/lib/services/activity";
import { listRides } from "@/lib/services/rides";
import { requestTime } from "@/lib/time";

/** Enough to see the shape of someone's history without becoming a second list page. */
const RECENT_RIDES = 10;

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/riders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [dict, rider] = await Promise.all([getDictionary(), getRider(id)]);
  return { title: rider?.name ?? dict.admin.riders.title };
}

/**
 * One passenger's record.
 *
 * The three things support is ever called about: who they are, what they have
 * ridden, and what has been done to their account. Their rides link straight
 * through to the ride record, which links back to the driver — so a complaint
 * that arrives naming any one of the three can be followed to the other two.
 */
export default async function RiderPage({ params }: PageProps<"/[lang]/admin/riders/[id]">) {
  const { id } = await params;
  const [admin, dict, locale] = await Promise.all([requireAdmin(), getDictionary(), getLocale()]);
  if (!can(admin.role, "riders:view")) return <AccessDenied dict={dict} />;

  const rider = await getRider(id);
  if (!rider) notFound();

  const [rides, activity] = await Promise.all([
    listRides({ rider: id, page: 1, pageSize: RECENT_RIDES }),
    listActivityFor("rider", id).catch(() => []),
  ]);

  const t = dict.admin.riders;
  const d = t.detail;
  const now = requestTime();
  const canManage = can(admin.role, "riders:manage");
  const blocked = rider.status === "blocked";

  return (
    <div className="space-y-6">
      <BackLink href={`/${locale}/admin/riders`} label={d.back} />

      {/* Identity */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="h-20 bg-asphalt bg-road-grid" aria-hidden="true" />
        <div className="flex flex-col gap-5 px-6 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar className="-mt-10 size-20 rounded-2xl ring-4 ring-card after:rounded-2xl">
              <AvatarFallback className="rounded-2xl bg-brand text-2xl font-bold text-asphalt">
                {initials(rider.name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{rider.name}</h1>
                <RiderStatusBadge status={rider.status} label={dict.admin.statuses.rider[rider.status]} />
              </div>
              <p className="ltr-nums flex items-center gap-2 text-sm text-muted-foreground">
                <PhoneIcon className="size-4" aria-hidden="true" />
                {formatPhone(rider.phone)}
              </p>
            </div>
          </div>
          {canManage ? (
            <RiderActions rider={{ id: rider.id, name: rider.name, status: rider.status }} />
          ) : null}
        </div>
      </Card>

      {blocked ? (
        <Alert variant="destructive">
          <BanIcon />
          <AlertTitle>{dict.admin.statuses.rider.blocked}</AlertTitle>
          <AlertDescription>{d.blockedNotice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RecentRides
            rides={rides.items}
            total={rides.total}
            dict={dict}
            locale={locale}
            title={d.rides}
            emptyText={d.noRides}
            showingRecent={d.showingRecent}
            counterpart="driver"
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4">
              <Figure label={d.completed} value={formatNumber(locale, rider.rides.completed)} />
              <Figure label={d.cancelled} value={formatNumber(locale, rider.rides.cancelled)} />
              <Figure
                label={d.spend}
                value={formatCurrency(locale, rider.spend.total, rider.spend.currency)}
              />
              <Figure
                label={d.rating}
                value={
                  rider.rating.count > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <StarIcon className="size-4 fill-brand text-brand" aria-hidden="true" />
                      {formatNumber(locale, rider.rating.average, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    </span>
                  ) : (
                    <span className="text-base font-normal text-muted-foreground">{d.noRating}</span>
                  )
                }
                note={
                  rider.rating.count > 0
                    ? interpolate(d.ratingCount, { count: formatNumber(locale, rider.rating.count) })
                    : undefined
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.contact}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <Line label={d.phone}>
                  <a href={`tel:${rider.phone}`} className="ltr-nums hover:underline" dir="ltr">
                    {formatPhone(rider.phone)}
                  </a>
                </Line>
                <Line label={d.email}>
                  {rider.email ? (
                    <a
                      href={`mailto:${rider.email}`}
                      className="inline-flex items-center gap-1.5 hover:underline"
                      dir="ltr"
                    >
                      <MailIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{rider.email}</span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{dict.common.notSet}</span>
                  )}
                </Line>
                <Line label={d.joined}>{formatDate(locale, rider.createdAt)}</Line>
                <Line label={d.lastRide}>
                  {rider.lastRideAt ? (
                    formatDate(locale, rider.lastRideAt)
                  ) : (
                    <span className="text-muted-foreground">{d.never}</span>
                  )}
                </Line>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.activity}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={activity} dict={dict} locale={locale} emptyText={d.noActivity} now={now} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-xl font-bold tracking-tight">{value}</p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{children}</dd>
    </div>
  );
}
