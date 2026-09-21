import type { Metadata } from "next";

import { DriveApp } from "@/components/drive/drive-app";
import { hasLocale, locales } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export async function generateMetadata({ params }: PageProps<"/[lang]/driver">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.meta.driverSpaceTitle,
    description: dict.meta.driverSpaceDescription,
    alternates: {
      canonical: `/${lang}/driver`,
      languages: Object.fromEntries(locales.map((locale) => [locale, `/${locale}/driver`])),
    },
    openGraph: { title: dict.meta.driverSpaceTitle, description: dict.meta.driverSpaceDescription },
    // A driver's working screen is nobody's search result. The page that sells
    // driving for Doura Go is /drive, and that one is indexed.
    robots: { index: false, follow: true },
  };
}

/**
 * The driver space.
 *
 * Everything below the fold here is a Client Component: the screen is driven
 * by a session cookie, a map, a position and three polls, none of which a
 * server render can know anything useful about. The server's job is the
 * language — the whole dictionary slice is handed over once, so nothing is
 * fetched to say "Go online".
 */
export default async function DriverPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return <DriveApp copy={dict.driverPage} common={dict.common} locale={locale} />;
}
