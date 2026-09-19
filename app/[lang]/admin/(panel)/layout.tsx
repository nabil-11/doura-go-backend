import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { DictionaryProvider } from "@/components/i18n/locale-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { countDriversByStatus } from "@/lib/services/drivers";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: { default: dict.meta.adminTitle, template: `%s · ${dict.meta.adminTitle} · Doura Go` },
    robots: { index: false, follow: false },
  };
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [dict, cookieStore, counts] = await Promise.all([
    getDictionary(),
    cookies(),
    can(admin.role, "drivers:view") ? countDriversByStatus() : null,
  ]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <DictionaryProvider dict={dict}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AdminSidebar
          admin={{ name: admin.name, email: admin.email, role: admin.role }}
          pendingDrivers={counts?.pending ?? 0}
        />
        <SidebarInset className="min-w-0">
          <AdminHeader />
          <div id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DictionaryProvider>
  );
}
