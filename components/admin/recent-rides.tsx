import { CarTaxiFrontIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/admin/empty-state";
import { RideStatusBadge } from "@/components/admin/status-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatCurrency, formatDateTime, formatNumber, interpolate } from "@/lib/i18n/format";
import type { RideListItem } from "@/lib/services/rides";

/**
 * The rides on someone's record.
 *
 * The same table on the rider's page and the driver's, because it is the same
 * question from two ends — and because a support call that arrives naming one
 * of the three (a person, a ride, the other person) has to be followable to
 * the other two. Every row is two links: the ride, and whoever was at the
 * other end of it.
 */
export function RecentRides({
  rides,
  total,
  dict,
  locale,
  title,
  emptyText,
  showingRecent,
  counterpart,
}: {
  rides: RideListItem[];
  /** Every ride on the record, so a truncated list can say so. */
  total: number;
  dict: Dictionary;
  locale: Locale;
  title: string;
  emptyText: string;
  /** "The {count} most recent of {total}" */
  showingRecent: string;
  /** Which side of the ride this page is *not*: the one worth naming here. */
  counterpart: "rider" | "driver";
}) {
  const t = dict.admin.rides;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex-row items-baseline justify-between gap-4 border-b px-4 py-3.5">
        <CardTitle className="text-base">{title}</CardTitle>
        {total > rides.length ? (
          <span className="text-xs text-muted-foreground">
            {interpolate(showingRecent, {
              count: formatNumber(locale, rides.length),
              total: formatNumber(locale, total),
            })}
          </span>
        ) : null}
      </CardHeader>

      {rides.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-4">{t.table.ride}</TableHead>
              <TableHead className="hidden md:table-cell">{t.table.route}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {counterpart === "driver" ? t.table.driver : t.table.rider}
              </TableHead>
              <TableHead>{t.table.fare}</TableHead>
              <TableHead className="pe-4">{t.table.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rides.map((ride) => {
              const other = counterpart === "driver" ? ride.driver : ride.rider;
              return (
                <TableRow key={ride.id}>
                  <TableCell className="ps-4">
                    {/* The whole row would be a bigger target, but a link
                        inside a link is not one — the person beside it has a
                        destination of their own. */}
                    <Link
                      href={`/${locale}/admin/rides/${ride.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                      dir="ltr"
                    >
                      {ride.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDateTime(locale, ride.requestedAt)}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-xs md:table-cell">
                    <p className="truncate text-sm">{ride.pickup}</p>
                    <p className="truncate text-xs text-muted-foreground">{ride.dropoff}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {other ? (
                      <Link
                        href={`/${locale}/admin/${counterpart === "driver" ? "drivers" : "riders"}/${other.id}`}
                        className="text-sm hover:underline"
                      >
                        {other.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t.unassigned}</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular">{formatCurrency(locale, ride.total, ride.currency)}</TableCell>
                  <TableCell className="pe-4">
                    <RideStatusBadge status={ride.status} label={dict.admin.statuses.ride[ride.status]} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState icon={CarTaxiFrontIcon} title={emptyText} />
      )}
    </Card>
  );
}
