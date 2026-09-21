import { ArrowDownIcon, CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DriverApplicationForm } from "@/components/site/driver-application-form";
import { SectionHeading } from "@/components/site/home-sections";
import { Button } from "@/components/ui/button";
import { cities } from "@/lib/config/site";
import { hasLocale, locales } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export async function generateMetadata({ params }: PageProps<"/[lang]/drive">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.meta.driveTitle,
    description: dict.meta.driveDescription,
    alternates: {
      canonical: `/${lang}/drive`,
      languages: Object.fromEntries(locales.map((locale) => [locale, `/${locale}/drive`])),
    },
    openGraph: { title: dict.meta.driveTitle, description: dict.meta.driveDescription },
  };
}

export default async function DrivePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.drivePage;

  return (
    <>
      <section className="relative isolate overflow-hidden bg-asphalt px-4 pt-16 pb-24 text-white sm:px-6">
        <div className="bg-road-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden="true" />
        <div className="absolute -top-32 start-[-10%] -z-10 size-[480px] rounded-full bg-brand/20 blur-[110px]" aria-hidden="true" />
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">{t.eyebrow}</p>
          <h1 className="mt-4 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">{t.subtitle}</p>
          <Button asChild className="mt-9 h-12 px-6 text-base font-semibold">
            <Link href={`/${locale}/drive#apply`}>
              {t.applyCta}
              <ArrowDownIcon />
            </Link>
          </Button>
          {/* Already approved? The application form below is not for you. */}
          <p className="mt-5 text-sm text-white/55">
            <Link
              href={`/${locale}/driver`}
              className="font-semibold text-brand underline-offset-4 hover:underline"
            >
              {dict.site.nav.driverSpace}
            </Link>
          </p>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-12 lg:sticky lg:top-24 lg:self-start">
            <div id="requirements" className="scroll-mt-24">
              <SectionHeading eyebrow={dict.site.nav.drive} title={t.requirements.title} />
              <ul className="mt-6 space-y-3">
                {t.requirements.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-asphalt">
                      <CheckIcon className="size-3" aria-hidden="true" />
                    </span>
                    <span className="text-sm sm:text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-bold">{t.steps.title}</h2>
              <ol className="mt-6 space-y-5">
                {t.steps.items.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-asphalt text-sm font-bold text-brand">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div
            id="apply"
            className="relative scroll-mt-24 rounded-3xl bg-card p-6 shadow-[0_24px_60px_-30px_rgb(15_17_21/0.45)] ring-1 ring-foreground/5 sm:p-9"
          >
            <h2 className="text-2xl font-bold">{t.form.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t.form.subtitle}</p>
            <div className="mt-8">
              <DriverApplicationForm
                copy={t.form}
                vehicleTypes={dict.vehicleTypes}
                messages={{ validation: dict.validation, errors: dict.errors }}
                cities={cities.map((city) => ({ id: city.id, name: city.name[locale] }))}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
