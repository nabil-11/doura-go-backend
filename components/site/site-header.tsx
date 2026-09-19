import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

import { MobileNav } from "./mobile-nav";

export function siteNavItems(dict: Dictionary, locale: Locale) {
  return [
    { href: `/${locale}#how`, label: dict.site.nav.ride },
    { href: `/${locale}#safety`, label: dict.site.nav.safety },
    { href: `/${locale}/drive`, label: dict.site.nav.drive },
    { href: `/${locale}#cities`, label: dict.site.nav.cities },
    { href: `/${locale}#faq`, label: dict.site.nav.faq },
  ];
}

export function SiteHeader({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const items = siteNavItems(dict, locale);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-asphalt/85 text-white backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href={`/${locale}`} className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-brand/60">
          <Logo tone="light" />
          <span className="sr-only">{dict.common.appName}</span>
        </Link>

        <nav aria-label={dict.site.nav.primary} className="ms-4 hidden items-center gap-0.5 lg:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors outline-none hover:bg-white/5 hover:text-white focus-visible:ring-3 focus-visible:ring-brand/60"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1.5">
          <LocaleSwitcher label={dict.common.language} tone="light" />
          <Button asChild className="hidden h-9 px-4 font-semibold sm:inline-flex">
            <Link href={`/${locale}/drive`}>{dict.site.nav.becomeDriver}</Link>
          </Button>
          <MobileNav
            items={items}
            cta={{ href: `/${locale}/drive`, label: dict.site.nav.becomeDriver }}
            labels={{ open: dict.common.openMenu, title: dict.site.nav.primary }}
          />
        </div>
      </div>
    </header>
  );
}
