import { HistoryIcon } from "lucide-react";
import type { Metadata } from "next";

import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { PricingForm } from "@/components/admin/pricing/pricing-form";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { formatDateTime, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { getPricing } from "@/lib/services/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.pricing.title };
}

export default async function PricingPage() {
  const [admin, dict, locale] = await Promise.all([requireAdmin(), getDictionary(), getLocale()]);
  if (!can(admin.role, "pricing:view")) return <AccessDenied dict={dict} />;

  const pricing = await getPricing();
  const t = dict.admin.pricing;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <Badge variant="outline" className="h-7 gap-1.5 px-2.5 font-normal text-muted-foreground">
            <HistoryIcon className="size-3.5" aria-hidden="true" />
            {pricing.isDefault || !pricing.updatedAt
              ? t.defaults
              : interpolate(t.lastUpdated, {
                  date: formatDateTime(locale, pricing.updatedAt),
                  name: pricing.updatedByName ?? "—",
                })}
          </Badge>
        }
      />
      <PricingForm initial={pricing.values} canEdit={can(admin.role, "pricing:manage")} />
    </div>
  );
}
