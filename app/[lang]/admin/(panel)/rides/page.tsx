import { RouteIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/admin/access-denied";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterTabs, ListBody, ListStateProvider, PaginationBar, SearchFilter } from "@/components/admin/list-state";
import { PageHeader } from "@/components/admin/page-header";
import { RideStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { RIDE_FILTERS } from "@/lib/domain/ride";
import { formatCurrency, formatDateTime } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { PAGE_SIZE, parsePage, parseSearch, pickParam } from "@/lib/services/query";
import { countRidesByFilter, listRides } from "@/lib/services/rides";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.rides.title };
}

export default async function RidesPage({ searchParams }: PageProps<"/[lang]/admin/rides">) {
  const [admin, dict, locale, query] = await Promise.all([requireAdmin(), getDictionary(), getLocale(), searchParams]);
  if (!can(admin.role, "rides:view")) return <AccessDenied dict={dict} />;

  const filter = pickParam(query.status, RIDE_FILTERS);
  const q = parseSearch(query.q);
  const page = parsePage(query.page);
  const [result, counts] = await Promise.all([
    listRides({ filter, q, page, pageSize: PAGE_SIZE }),
    countRidesByFilter(q),
  ]);

  const t = dict.admin.rides;
  const base = `/${locale}/admin/rides`;
  const filtered = !!((filter && filter !== "all") || q);

  return (
    <ListStateProvider>
      <div className="space-y-6">
        <PageHeader title={t.title} description={t.subtitle} />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs label={t.table.status} items={RIDE_FILTERS.map((value) => ({ value, label: t.tabs[value], count: counts[value] }))} />
          <SearchFilter placeholder={t.searchPlaceholder} />
        </div>

        <ListBody>
          <Card className="gap-0 overflow-hidden py-0">
            {result.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-4">{t.table.ride}</TableHead>
                    <TableHead className="hidden md:table-cell">{t.table.rider}</TableHead>
                    <TableHead className="hidden md:table-cell">{t.table.driver}</TableHead>
                    <TableHead className="hidden xl:table-cell">{t.table.route}</TableHead>
                    <TableHead className="text-end">{t.table.fare}</TableHead>
                    <TableHead>{t.table.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((ride) => (
                    <TableRow key={ride.id}>
                      <TableCell className="ps-4">
                        <Link href={`${base}/${ride.id}`} className="font-mono text-sm font-semibold hover:underline" dir="ltr">
                          {ride.code}
                        </Link>
                        <p className="text-xs text-muted-foreground">{formatDateTime(locale, ride.requestedAt)}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{ride.rider?.name ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {ride.driver ? (
                          <Link href={`/${locale}/admin/drivers/${ride.driver.id}`} className="hover:underline">
                            {ride.driver.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{t.unassigned}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-72 xl:table-cell">
                        <p className="truncate text-sm">{ride.pickup}</p>
                        <p className="truncate text-xs text-muted-foreground">→ {ride.dropoff}</p>
                      </TableCell>
                      <TableCell className="tabular text-end font-medium">
                        {formatCurrency(locale, ride.total, ride.currency)}
                      </TableCell>
                      <TableCell>
                        <RideStatusBadge status={ride.status} label={dict.admin.statuses.ride[ride.status]} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : filtered ? (
              <EmptyState icon={SearchXIcon} title={t.empty.filteredTitle} description={t.empty.filteredDescription}>
                <Button asChild variant="outline" size="sm">
                  <Link href={base}>{dict.admin.drivers.empty.clear}</Link>
                </Button>
              </EmptyState>
            ) : (
              <EmptyState icon={RouteIcon} title={t.empty.title} description={t.empty.description} />
            )}
            <PaginationBar page={result.page} pageCount={result.pageCount} total={result.total} pageSize={result.pageSize} />
          </Card>
        </ListBody>
      </div>
    </ListStateProvider>
  );
}
