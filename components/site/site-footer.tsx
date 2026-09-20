import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { interpolate } from "@/lib/i18n/format";

export function SiteFooter({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.site.footer;
  const columns = [
    {
      title: t.riders,
      links: [
        { href: `/${locale}#how`, label: t.howItWorks },
        { href: `/${locale}#safety`, label: t.safety },
        { href: `/${locale}#faq`, label: t.faq },
      ],
    },
    {
      title: t.drivers,
      links: [
        { href: `/${locale}/drive#apply`, label: t.apply },
        { href: `/${locale}/drive#requirements`, label: t.requirements },
        { href: `/${locale}/driver-app`, label: t.driverApp },
      ],
    },
    {
      title: t.company,
      links: [{ href: `/${locale}/admin`, label: t.backoffice }],
    },
  ];

  return (
    <footer className="bg-asphalt text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo tone="light" />
          <p className="max-w-xs text-sm leading-relaxed text-white/60">{t.tagline}</p>
          <LocaleSwitcher label={dict.common.language} tone="light" className="-ms-2" />
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-semibold text-white">{column.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{interpolate(t.rights, { year: new Date().getFullYear() })}</p>
          <p className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-[#E70013]" aria-hidden="true" />
            {t.madeIn}
          </p>
        </div>
      </div>
    </footer>
  );
}
