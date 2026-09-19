import type { Metadata } from "next";

import {
  AppCta,
  CitiesSection,
  DriveSection,
  FaqSection,
  Hero,
  HowItWorks,
  SafetySection,
  ValueProps,
} from "@/components/site/home-sections";
import { DEFAULT_PRICING, estimateFare } from "@/lib/domain/pricing";
import { hasLocale, locales } from "@/lib/i18n/config";
import { formatCurrency } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: { absolute: dict.meta.siteTitle },
    alternates: {
      canonical: `/${lang}`,
      languages: Object.fromEntries(locales.map((locale) => [locale, `/${locale}`])),
    },
  };
}

export default async function HomePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  // The mockup shows a real estimate for the illustrated trip (≈6 km, 16 min).
  const fare = estimateFare(DEFAULT_PRICING, 6.2, 16);

  return (
    <>
      <Hero dict={dict} locale={locale} fare={formatCurrency(locale, fare.total, fare.currency)} />
      <ValueProps dict={dict} locale={locale} />
      <HowItWorks dict={dict} locale={locale} />
      <SafetySection dict={dict} locale={locale} />
      <DriveSection dict={dict} locale={locale} />
      <CitiesSection dict={dict} locale={locale} />
      <FaqSection dict={dict} locale={locale} />
      <AppCta dict={dict} locale={locale} />
    </>
  );
}
