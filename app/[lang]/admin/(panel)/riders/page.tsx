import { SearchXIcon, StarIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/admin/access-denied";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterTabs, ListBody, ListStateProvider, PaginationBar, SearchFilter } from "@/components/admin/list-state";
import { PageHeader } from "@/components/admin/page-header";
import { RiderActions } from "@/components/admin/riders/rider-actions";
import { RiderStatusBadge } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { RIDER_STATUSES } from "@/lib/domain/ride";
import { formatDate, formatNumber, formatPhone, initials } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { PAGE_SIZE, parsePage, parseSearch, pickParam } from "@/lib/services/query";
import { countRidersByStatus, listRiders } from "@/lib/services/riders";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.riders.title };
}

export default async function RidersPage({ searchParams }: PageProps<"/[lang]/admin/riders">) {
  const [admin, dict, locale, query] = await Promise.all([requireAdmin(), getDictionary(), getLocale(), searchParams]);
  if (!can(admin.role, "riders:view")) return <AccessDenied dict={dict} />;

  const status = pickParam(query.status, RIDER_STATUSES);
  const q = parseSearch(query.q);
  const page = parsePage(query.page);
  const [result, counts] = await Promise.all([
    listRiders({ status, q, page, pageSize: PAGE_SIZE }),
    countRidersByStatus(q),
  ]);

  const t = dict.admin.riders;
  const canManage = can(admin.role, "riders:manage");
  const filtered = !!(status || q);

  return (
    <ListStateProvider>
      <div className="space-y-6">
        <PageHeader title={t.title} description={t.subtitle} />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            label={t.table.status}
            items={[
              { value: "all", label: t.tabs.all, count: counts.all },
              { value: "active", label: t.tabs.active, count: counts.active },
              { value: "blocked", label: t.tabs.blocked, count: counts.blocked },
            ]}
          />
          <SearchFilter placeholder={t.searchPlaceholder} />
        </div>

        <ListBody>
          <Card className="gap-0 overflow-hidden py-0">
            {result.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-4">{t.table.rider}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t.table.rides}</TableHead>
                    <TableHead className="hidden md:table-cell">{t.table.rating}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t.table.lastRide}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t.table.joined}</TableHead>
                    <TableHead>{t.table.status}</TableHead>
                    {canManage ? (
                      <TableHead className="pe-4">
                        <span className="sr-only">{dict.common.actions}</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((rider) => (
                    <TableRow key={rider.id}>
                      <TableCell className="ps-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-muted text-xs font-semibold">{initials(rider.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link
                              href={`/${locale}/admin/riders/${rider.id}`}
                              className="block truncate font-medium hover:underline"
                            >
                              {rider.name}
                            </Link>
                            <p className="ltr-nums text-xs text-muted-foreground">{formatPhone(rider.phone)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular hidden sm:table-cell">{formatNumber(locale, rider.completedRides)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {rider.rating.count > 0 ? (
                          <span className="tabular inline-flex items-center gap-1">
                            <StarIcon className="size-3.5 fill-brand text-brand" aria-hidden="true" />
                            {formatNumber(locale, rider.rating.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {rider.lastRideAt ? formatDate(locale, rider.lastRideAt) : "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {formatDate(locale, rider.createdAt)}
                      </TableCell>
                      <TableCell>
                        <RiderStatusBadge status={rider.status} label={dict.admin.statuses.rider[rider.status]} />
                      </TableCell>
                      {canManage ? (
                        <TableCell className="pe-4 text-end">
                          <RiderActions rider={{ id: rider.id, name: rider.name, status: rider.status }} />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : filtered ? (
              <EmptyState icon={SearchXIcon} title={t.empty.filteredTitle} description={t.empty.filteredDescription}>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/admin/riders`}>{dict.admin.drivers.empty.clear}</Link>
                </Button>
              </EmptyState>
            ) : (
              <EmptyState icon={UsersIcon} title={t.empty.title} description={t.empty.description} />
            )}
            <PaginationBar page={result.page} pageCount={result.pageCount} total={result.total} pageSize={result.pageSize} />
          </Card>
        </ListBody>
      </div>
    </ListStateProvider>
  );
}
