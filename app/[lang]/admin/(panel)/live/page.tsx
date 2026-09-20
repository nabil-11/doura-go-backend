import type { Metadata } from "next";

import { AccessDenied } from "@/components/admin/access-denied";
import { LiveBoard } from "@/components/admin/live/live-board";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLiveSnapshot } from "@/lib/services/live";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.live.title };
}

export default async function LivePage() {
  const [admin, dict] = await Promise.all([requireAdmin(), getDictionary()]);
  if (!can(admin.role, "rides:view")) return <AccessDenied dict={dict} />;

  // Rendered on the server so the map has pins the moment it appears; the
  // board keeps it current from there.
  const snapshot = await getLiveSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader title={dict.admin.live.title} description={dict.admin.live.subtitle} />
      <LiveBoard initial={snapshot} />
    </div>
  );
}
