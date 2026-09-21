import type { Metadata } from "next";

import { RideApp } from "@/components/ride/ride-app";
import { hasLocale, locales } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export async function generateMetadata({ params }: PageProps<"/[lang]/ride">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.meta.rideTitle,
    description: dict.meta.rideDescription,
    alternates: {
      canonical: `/${lang}/ride`,
      languages: Object.fromEntries(locales.map((locale) => [locale, `/${locale}/ride`])),
    },
    openGraph: { title: dict.meta.rideTitle, description: dict.meta.rideDescription },
    // A live ride is nobody's search result.
    robots: { index: false, follow: true },
  };
}

/**
 * Booking a moto from the website.
 *
 * Everything below the fold here is a Client Component: the screen is driven
 * by a session cookie, a map and a poll, none of which a server render can
 * know anything useful about. The server's job is the language — the whole
 * dictionary slice is handed over once, so nothing is fetched to say "Cash".
 */
export default async function RidePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return <RideApp copy={dict.ridePage} common={dict.common} locale={locale} />;
}
