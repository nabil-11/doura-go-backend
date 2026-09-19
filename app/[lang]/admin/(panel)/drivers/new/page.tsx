import type { Metadata } from "next";

import { AccessDenied } from "@/components/admin/access-denied";
import { DriverForm } from "@/components/admin/drivers/driver-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.drivers.form.createTitle };
}

export default async function NewDriverPage() {
  const [admin, dict, locale] = await Promise.all([requireAdmin(), getDictionary(), getLocale()]);
  if (!can(admin.role, "drivers:manage")) return <AccessDenied dict={dict} />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={dict.admin.drivers.form.createTitle}
        description={dict.admin.drivers.form.createSubtitle}
        back={{ href: `/${locale}/admin/drivers`, label: dict.admin.drivers.detail.back }}
      />
      <DriverForm mode="create" />
    </div>
  );
}
