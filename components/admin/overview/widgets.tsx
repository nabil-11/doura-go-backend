import { CoinsIcon, HourglassIcon, InboxIcon, MotorbikeIcon, RouteIcon } from "lucide-react";
import Link from "next/link";

import { ActivityFeed } from "@/components/admin/activity-feed";
import { EmptyState } from "@/components/admin/empty-state";
import { RidesChartCard } from "@/components/admin/overview/rides-chart-card";
import { StatCard } from "@/components/admin/stat-card";
import { DriverStatusBadge, driverStatusStyle } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cityName } from "@/lib/config/site";
import { DRIVER_STATUSES } from "@/lib/domain/driver";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatCurrency, formatDate, formatNumber, formatRelative, initials, interpolate } from "@/lib/i18n/format";
import { listRecentActivity } from "@/lib/services/activity";
import { countDriversByStatus, countOnlineDrivers, listPendingDrivers } from "@/lib/services/drivers";
import { getRideStats } from "@/lib/services/rides";
import { zonedMidnight } from "@/lib/time";

type WidgetProps = { dict: Dictionary; locale: Locale };

// Headline amounts read better in whole dinars; detail pages keep the millimes.
const WHOLE_UNITS = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;

export async function KpiCards({ dict, locale }: WidgetProps) {
  const t = dict.admin.overview.kpis;
  const [counts, online, rides] = await Promise.all([countDriversByStatus(), countOnlineDrivers(), getRideStats()]);
  const base = `/${locale}/admin`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t.activeDrivers}
        value={formatNumber(locale, counts.active)}
        hint={interpolate(t.onlineNow, { count: formatNumber(locale, online) })}
        icon={MotorbikeIcon}
        href={`${base}/drivers?status=active`}
      />
      <StatCard
        label={t.pendingApplications}
        value={formatNumber(locale, counts.pending)}
        hint={t.toReview}
        icon={HourglassIcon}
        href={`${base}/drivers?status=pending`}
        highlight={counts.pending > 0}
      />
      <StatCard
        label={t.ridesToday}
        value={formatNumber(locale, rides.ridesToday)}
        hint={interpolate(t.ridesYesterday, { count: formatNumber(locale, rides.ridesYesterday) })}
        icon={RouteIcon}
        href={`${base}/rides`}
      />
      <StatCard
        label={t.commissionMonth}
        value={formatCurrency(locale, rides.commissionMonth, rides.currency, WHOLE_UNITS)}
        hint={interpolate(t.grossMonth, {
          amount: formatCurrency(locale, rides.grossMonth, rides.currency, WHOLE_UNITS),
        })}
        icon={CoinsIcon}
      />
    </div>
  );
}

export async function RidesChartWidget({ dict, locale, className }: WidgetProps & { className?: string }) {
  const t = dict.admin.overview.ridesChart;
  const stats = await getRideStats();
  const data = stats.completedSeries.map((point) => {
    const date = zonedMidnight(point.day);
    return {
      day: point.day,
      label: formatDate(locale, date, { day: "numeric", month: "short" }),
      fullLabel: formatDate(locale, date, { weekday: "long", day: "numeric", month: "long" }),
      completed: point.completed,
    };
  });

  return (
    <RidesChartCard
      className={className}
      data={data}
      labels={{
        title: t.title,
        subtitle: t.subtitle,
        total: interpolate(t.total, { count: formatNumber(locale, stats.completedTotal) }),
        rides: t.rides,
        date: t.date,
        chartView: t.chartView,
        tableView: t.tableView,
        empty: t.empty,
      }}
    />
  );
}

export async function DriversByStatusWidget({ dict, locale }: WidgetProps) {
  const t = dict.admin.overview.driversByStatus;
  const counts = await countDriversByStatus();
  const max = Math.max(1, ...DRIVER_STATUSES.map((status) => counts[status]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>
          {t.subtitle} · {formatNumber(locale, counts.all)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {counts.all === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="space-y-5">
            {DRIVER_STATUSES.map((status) => (
              <li key={status}>
                <Link
                  href={`/${locale}/admin/drivers?status=${status}`}
                  className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <DriverStatusBadge status={status} label={dict.admin.statuses.driver[status]} />
                    <span className="tabular text-sm font-semibold">{formatNumber(locale, counts[status])}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(counts[status] / max) * 100}%`,
                        backgroundColor: driverStatusStyle[status].color,
                      }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export async function PendingApplicationsWidget({ dict, locale, now }: WidgetProps & { now: number }) {
  const t = dict.admin.overview.applications;
  const drivers = await listPendingDrivers(5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <EmptyState icon={InboxIcon} title={t.empty} className="py-8" />
        ) : (
          <ul className="divide-y">
            {drivers.map((driver) => (
              <li key={driver.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar className="size-9">
                  {driver.photoUrl ? <AvatarImage src={driver.photoUrl} alt="" /> : null}
                  <AvatarFallback className="bg-brand/20 text-xs font-semibold text-foreground">
                    {initials(driver.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{driver.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {cityName(driver.city, locale)} · {[driver.vehicle.brand, driver.vehicle.model].filter(Boolean).join(" ")} ·{" "}
                    <time dateTime={driver.createdAt.toISOString()} title={formatDate(locale, driver.createdAt)}>
                      {formatRelative(locale, driver.createdAt, now)}
                    </time>
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/admin/drivers/${driver.id}`}>{t.review}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export async function RecentActivityWidget({ dict, locale, now }: WidgetProps & { now: number }) {
  const items = await listRecentActivity(7);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{dict.admin.overview.activity.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityFeed items={items} dict={dict} locale={locale} emptyText={dict.admin.overview.activity.empty} now={now} />
      </CardContent>
    </Card>
  );
}
