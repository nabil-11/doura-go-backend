import { AlertTriangleIcon, ArrowRightIcon, DownloadIcon, SmartphoneIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DRIVER_APK_PATH,
  DRIVER_APP_MIN_ANDROID,
  DRIVER_APP_VERSION,
  driverApkInfo,
  formatBytes,
} from "@/lib/config/driver-app";
import { hasLocale, locales } from "@/lib/i18n/config";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export async function generateMetadata({ params }: PageProps<"/[lang]/driver-app">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const t = dict.site.driverApp;
  return {
    title: t.title,
    description: t.subtitle,
    alternates: {
      canonical: `/${lang}/driver-app`,
      languages: Object.fromEntries(locales.map((locale) => [locale, `/${locale}/driver-app`])),
    },
    openGraph: { title: t.title, description: t.subtitle },
    // A download page has nothing to offer a search engine, and an APK link in
    // search results is exactly how people end up installing the wrong file.
    robots: { index: false, follow: true },
  };
}

/**
 * Where a driver gets the app.
 *
 * Android has no store listing for a product this young, so the file is served
 * from here — which is also why the page says, plainly, that this is the only
 * place to get it. The build's size and date are read while this page is
 * compiled, so the page never promises a file that isn't there.
 */
export default async function DriverAppPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.site.driverApp;
  const apk = driverApkInfo();

  const steps = [t.step1, t.step2, t.step3];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-asphalt px-4 pt-16 pb-20 text-white sm:px-6">
        <div
          className="bg-road-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          aria-hidden="true"
        />
        <div className="absolute -top-32 start-[-10%] -z-10 size-[480px] rounded-full bg-brand/20 blur-[110px]" aria-hidden="true" />

        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">{t.eyebrow}</p>
          <h1 className="mt-4 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{t.subtitle}</p>

          {apk.available ? (
            <>
              <Button asChild className="mt-9 h-13 px-7 text-base font-semibold">
                {/* A plain anchor, not a router link: this leaves the app. */}
                <a href={DRIVER_APK_PATH} download>
                  <DownloadIcon />
                  {t.download}
                </a>
              </Button>
              <p className="tabular mt-4 text-sm text-white/50">
                {interpolate(t.version, { version: DRIVER_APP_VERSION })}
                {" · "}
                {interpolate(t.size, {
                  size: formatBytes(apk.bytes),
                  date: apk.updatedAt ? formatDate(locale, apk.updatedAt) : "—",
                })}
              </p>
            </>
          ) : (
            <div className="mx-auto mt-9 max-w-md rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
              <p className="font-semibold">{t.unavailable}</p>
              <p className="mt-1 text-sm text-white/60">{t.unavailableHint}</p>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t.stepsTitle}</h2>
            <ol className="mt-6 space-y-5">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span className="tabular grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-asphalt">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-muted-foreground">
              {interpolate(t.requirements, { version: DRIVER_APP_MIN_ANDROID })}
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-3 rounded-2xl border border-status-warning/40 bg-status-warning/10 px-5 py-4">
              <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-status-warning" aria-hidden="true" />
              <p className="text-sm leading-relaxed">{t.safety}</p>
            </div>

            <div className="rounded-2xl border px-5 py-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <SmartphoneIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                {t.iosTitle}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.iosBody}</p>
            </div>

            <div className="rounded-2xl bg-muted px-5 py-5">
              <h3 className="font-semibold">{t.notDriver}</h3>
              <Button asChild variant="link" className="mt-1 h-auto p-0 text-base">
                <Link href={`/${locale}/drive`}>
                  {t.apply}
                  <ArrowRightIcon className="rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
