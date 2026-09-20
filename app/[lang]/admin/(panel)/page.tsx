import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import {
  DriversByStatusWidget,
  KpiCards,
  PendingApplicationsWidget,
  RecentActivityWidget,
  RidesChartWidget,
} from "@/components/admin/overview/widgets";
import { ChartCardSkeleton, ListCardSkeleton, StatCardsSkeleton } from "@/components/admin/skeletons";
import { requireAdmin } from "@/lib/auth/guards";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { requestTime } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.overview.title };
}

export default async function OverviewPage() {
  await connection();
  const [admin, dict, locale] = await Promise.all([requireAdmin(), getDictionary(), getLocale()]);
  const now = requestTime();
  const firstName = admin.name.split(" ")[0] ?? admin.name;

  // Each widget streams in on its own, behind a skeleton of the same shape.
  return (
    <div className="space-y-6">
      <PageHeader
        title={interpolate(dict.admin.overview.greeting, { name: firstName })}
        description={dict.admin.overview.subtitle}
      />

      <Suspense fallback={<StatCardsSkeleton />}>
        <KpiCards dict={dict} locale={locale} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<ChartCardSkeleton className="lg:col-span-2" />}>
          <RidesChartWidget dict={dict} locale={locale} className="lg:col-span-2" />
        </Suspense>
        <Suspense fallback={<ListCardSkeleton rows={4} />}>
          <DriversByStatusWidget dict={dict} locale={locale} />
        </Suspense>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<ListCardSkeleton />}>
          <PendingApplicationsWidget dict={dict} locale={locale} now={now} />
        </Suspense>
        <Suspense fallback={<ListCardSkeleton />}>
          <RecentActivityWidget dict={dict} locale={locale} now={now} />
        </Suspense>
      </div>
    </div>
  );
}
