"use client";

import { PanelLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type Crumb = { label: string; href?: string };

function crumbsFor(segments: string[], dict: Dictionary, base: string): Crumb[] {
  const nav = dict.admin.nav;
  const [section, second, third] = segments;
  if (!section) return [{ label: nav.overview }];

  const sections: Record<string, string> = {
    drivers: nav.drivers,
    riders: nav.riders,
    rides: nav.rides,
    pricing: nav.pricing,
    team: nav.team,
    account: nav.account,
  };
  const sectionLabel = sections[section];
  if (!sectionLabel) return [{ label: nav.overview }];
  if (!second) return [{ label: sectionLabel }];

  const crumbs: Crumb[] = [{ label: sectionLabel, href: `${base}/${section}` }];
  if (section === "drivers" && second === "new") crumbs.push({ label: dict.admin.drivers.add });
  else if (section === "drivers" && third === "edit") {
    crumbs.push({ label: dict.admin.drivers.detail.profile, href: `${base}/drivers/${second}` });
    crumbs.push({ label: dict.common.edit });
  } else if (section === "drivers") crumbs.push({ label: dict.admin.drivers.detail.profile });
  else if (section === "rides") crumbs.push({ label: dict.admin.rides.table.ride });
  return crumbs;
}

export function AdminHeader() {
  const dict = useDictionary();
  const locale = useLocale();
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  const base = `/${locale}/admin`;
  const segments = pathname.replace(base, "").split("/").filter(Boolean);
  const crumbs = crumbsFor(segments, dict, base);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md md:px-5">
      <Button variant="ghost" size="icon-sm" onClick={toggleSidebar} aria-label={dict.admin.nav.toggleSidebar}>
        <PanelLeftIcon className="rtl:rotate-180" />
      </Button>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <Breadcrumb aria-label={dict.admin.nav.breadcrumb} className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, index) => (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href} className="truncate">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ms-auto flex items-center gap-1">
        <LocaleSwitcher label={dict.common.language} />
        <ThemeToggle
          labels={{
            theme: dict.common.theme,
            light: dict.common.themeLight,
            dark: dict.common.themeDark,
            system: dict.common.themeSystem,
          }}
        />
      </div>
    </header>
  );
}
