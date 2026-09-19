import { ExternalLinkIcon, MotorbikeIcon, PlusIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/admin/access-denied";
import { DriversTable } from "@/components/admin/drivers/drivers-table";
import { EmptyState } from "@/components/admin/empty-state";
import {
  FilterTabs,
  ListBody,
  ListStateProvider,
  PaginationBar,
  SearchFilter,
  SelectFilter,
} from "@/components/admin/list-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { cities, cityIds } from "@/lib/config/site";
import { DRIVER_STATUSES } from "@/lib/domain/driver";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { countDriversByStatus, listDrivers } from "@/lib/services/drivers";
import { PAGE_SIZE, parsePage, parseSearch, pickParam } from "@/lib/services/query";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.drivers.title };
}

export default async function DriversPage({ searchParams }: PageProps<"/[lang]/admin/drivers">) {
  const [admin, dict, locale, query] = await Promise.all([requireAdmin(), getDictionary(), getLocale(), searchParams]);
  if (!can(admin.role, "drivers:view")) return <AccessDenied dict={dict} />;

  const status = pickParam(query.status, DRIVER_STATUSES);
  const city = pickParam(query.city, cityIds);
  const q = parseSearch(query.q);
  const page = parsePage(query.page);

  const [result, counts] = await Promise.all([
    listDrivers({ status, city, q, page, pageSize: PAGE_SIZE }),
    countDriversByStatus({ city, q }),
  ]);

  const t = dict.admin.drivers;
  const base = `/${locale}/admin/drivers`;
  const filtered = !!(status || city || q);
  const permissions = {
    manage: can(admin.role, "drivers:manage"),
    review: can(admin.role, "drivers:review"),
    remove: can(admin.role, "drivers:delete"),
  };

  return (
    <ListStateProvider>
      <div className="space-y-6">
        <PageHeader
          title={t.title}
          description={t.subtitle}
          actions={
            permissions.manage ? (
              <Button asChild>
                <Link href={`${base}/new`}>
                  <PlusIcon />
                  {t.add}
                </Link>
              </Button>
            ) : null
          }
        />

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <FilterTabs
            label={t.table.status}
            items={[
              { value: "all", label: t.tabs.all, count: counts.all },
              ...DRIVER_STATUSES.map((value) => ({ value, label: t.tabs[value], count: counts[value] })),
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchFilter placeholder={t.searchPlaceholder} />
            <SelectFilter
              param="city"
              placeholder={t.table.city}
              allLabel={t.allCities}
              options={cities.map((item) => ({ value: item.id, label: item.name[locale] }))}
            />
          </div>
        </div>

        <ListBody>
          <Card className="gap-0 overflow-hidden py-0">
            {result.items.length > 0 ? (
              <DriversTable drivers={result.items} dict={dict} locale={locale} permissions={permissions} />
            ) : filtered ? (
              <EmptyState icon={SearchXIcon} title={t.empty.filteredTitle} description={t.empty.filteredDescription}>
                <Button asChild variant="outline" size="sm">
                  <Link href={base}>{t.empty.clear}</Link>
                </Button>
              </EmptyState>
            ) : (
              <EmptyState icon={MotorbikeIcon} title={t.empty.title} description={t.empty.description}>
                <div className="flex flex-wrap justify-center gap-2">
                  {permissions.manage ? (
                    <Button asChild size="sm">
                      <Link href={`${base}/new`}>
                        <PlusIcon />
                        {t.add}
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/${locale}/drive`} target="_blank">
                      <ExternalLinkIcon />
                      {t.empty.share}
                    </Link>
                  </Button>
                </div>
              </EmptyState>
            )}
            <PaginationBar page={result.page} pageCount={result.pageCount} total={result.total} pageSize={result.pageSize} />
          </Card>
        </ListBody>
      </div>
    </ListStateProvider>
  );
}
