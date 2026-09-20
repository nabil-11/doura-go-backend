import type { Metadata } from "next";

import { PasswordForm, ProfileForm } from "@/components/admin/account/account-forms";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.account.title };
}

export default async function AccountPage() {
  const [admin, dict] = await Promise.all([requireAdmin(), getDictionary()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={dict.admin.account.title} description={dict.admin.account.subtitle} />
      <ProfileForm name={admin.name} email={admin.email} roleLabel={dict.admin.roles[admin.role]} />
      <PasswordForm />
    </div>
  );
}
