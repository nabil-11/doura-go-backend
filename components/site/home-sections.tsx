import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  CheckIcon,
  HardHatIcon,
  HeadsetIcon,
  MapPinIcon,
  MotorbikeIcon,
  ReceiptTextIcon,
  Share2Icon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TimerIcon,
} from "lucide-react";
import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cities } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatCurrency } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { PhoneMockup } from "./phone-mockup";

type SectionProps = { dict: Dictionary; locale: Locale };

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  tone = "light",
  align = "start",
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  tone?: "light" | "dark";
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p
        className={cn(
          "inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase",
          tone === "dark" ? "text-brand" : "text-brand-deep dark:text-brand",
        )}
      >
        <span className="h-px w-6 bg-current" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl",
          tone === "dark" ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={cn("mt-4 text-base leading-relaxed sm:text-lg", tone === "dark" ? "text-white/65" : "text-muted-foreground")}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Hero({ dict, locale, fare }: SectionProps & { fare: string }) {
  const t = dict.site.hero;
  return (
    <section className="relative isolate overflow-hidden bg-asphalt text-white">
      <div className="bg-road-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" aria-hidden="true" />
      <div
        className="absolute -top-40 end-[-10%] -z-10 size-[560px] rounded-full bg-brand/25 blur-[120px]"
        aria-hidden="true"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-32 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20 lg:pb-40">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            {t.eyebrow}
          </p>
          <h1 className="mt-6 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block">{t.titleStart}</span>
            <span className="relative mt-1 inline-block text-brand">{t.titleEnd}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{t.subtitle}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 px-6 text-base font-semibold">
              <Link href={`/${locale}#app`}>
                <SmartphoneIcon />
                {t.primaryCta}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 border-white/20 bg-white/5 px-6 text-base font-semibold text-white hover:bg-white/10 hover:text-white dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <Link href={`/${locale}/drive`}>
                {t.secondaryCta}
                <ArrowRightIcon className="rtl:rotate-180" />
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-sm text-white/50">{t.note}</p>
        </div>

        <div className="relative">
          <div className="motion-safe:animate-float">
            <PhoneMockup copy={dict.site.mock} fare={fare} />
          </div>
          <FloatingChip className="start-0 top-24 sm:start-6 lg:-start-4" icon={<ShieldCheckIcon className="size-4 text-status-good" />}>
            {dict.site.values[2].title}
          </FloatingChip>
          <FloatingChip className="end-0 bottom-28 sm:end-6 lg:-end-2" icon={<TimerIcon className="size-4 text-brand-deep" />}>
            {dict.site.mock.eta}
          </FloatingChip>
        </div>
      </div>
    </section>
  );
}

function FloatingChip({ className, icon, children }: { className?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute z-10 hidden items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-semibold text-asphalt shadow-xl ring-1 ring-black/5 sm:flex",
        className,
      )}
    >
      {icon}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

const valueIcons = [TimerIcon, ReceiptTextIcon, BadgeCheckIcon, HardHatIcon];

export function ValueProps({ dict }: SectionProps) {
  return (
    <section className="relative z-10 -mt-20 px-4 sm:px-6" aria-label={dict.site.nav.ride}>
      <ul className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dict.site.values.map((value, index) => {
          const Icon = valueIcons[index] ?? BadgeCheckIcon;
          return (
            <li key={value.title} className="rounded-2xl bg-card p-5 shadow-[0_18px_40px_-24px_rgb(15_17_21/0.45)] ring-1 ring-foreground/5">
              <span className="grid size-10 place-items-center rounded-xl bg-brand text-asphalt">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{value.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{value.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

const stepIcons = [MapPinIcon, MotorbikeIcon, BanknoteIcon];

export function HowItWorks({ dict }: SectionProps) {
  const t = dict.site.how;
  return (
    <section id="how" className="scroll-mt-20 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} align="center" />
        <div className="relative mt-16">
          <div
            className="absolute inset-x-[16%] top-8 hidden border-t-2 border-dashed border-border md:block"
            aria-hidden="true"
          />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          {t.steps.map((step, index) => {
            const Icon = stepIcons[index] ?? MapPinIcon;
            return (
              <li key={step.title} className="relative flex flex-col items-center text-center">
                <span className="relative grid size-16 place-items-center rounded-2xl bg-asphalt text-brand shadow-lg ring-8 ring-background">
                  <Icon className="size-7" aria-hidden="true" />
                  <span className="absolute -end-2 -top-2 grid size-7 place-items-center rounded-full bg-brand text-xs font-bold text-asphalt ring-4 ring-background">
                    {index + 1}
                  </span>
                </span>
                <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </li>
            );
          })}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const safetyIcons = [BadgeCheckIcon, HardHatIcon, Share2Icon, HeadsetIcon];

export function SafetySection({ dict }: SectionProps) {
  const t = dict.site.safety;
  return (
    <section id="safety" className="scroll-mt-16 bg-asphalt px-4 py-24 text-white sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} tone="dark" />
          <div className="mt-10 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-asphalt">
              <ShieldCheckIcon className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm leading-relaxed text-white/75">{t.items[0].description}</p>
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {t.items.map((item, index) => {
            const Icon = safetyIcons[index] ?? BadgeCheckIcon;
            return (
              <li key={item.title} className="rounded-2xl border border-white/10 bg-asphalt-2 p-6 transition-colors hover:border-brand/40">
                <Icon className="size-6 text-brand" aria-hidden="true" />
                <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{item.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function DriveSection({ dict, locale }: SectionProps) {
  const t = dict.site.drive;
  // Illustrative figures for the "example week" card.
  const week = [42, 64, 38, 71, 88, 96, 55];
  const max = Math.max(...week);
  return (
    <section id="drive" className="scroll-mt-16 px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-14 overflow-hidden rounded-[2rem] bg-brand p-8 text-asphalt sm:p-12 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
            <span className="h-px w-6 bg-current" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{t.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-asphalt/75 sm:text-lg">{t.subtitle}</p>
          <ul className="mt-8 space-y-3">
            {t.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm font-medium sm:text-base">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-asphalt text-brand">
                  <CheckIcon className="size-3" aria-hidden="true" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-9 h-12 bg-asphalt px-6 text-base font-semibold text-white hover:bg-asphalt/90">
            <Link href={`/${locale}/drive#apply`}>
              {t.cta}
              <ArrowRightIcon className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>

        <div className="rounded-3xl bg-asphalt p-6 text-white shadow-2xl sm:p-8" aria-hidden="true">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/60">{t.exampleWeek}</p>
            <span className="grid size-9 place-items-center rounded-full bg-brand text-asphalt">
              <MotorbikeIcon className="size-5" />
            </span>
          </div>
          <p className="mt-2 text-4xl font-bold">{formatCurrency(locale, 486.5)}</p>
          <p className="mt-1 text-sm text-white/50">{t.earnings}</p>
          <div className="mt-8 flex h-28 items-end gap-2.5">
            {week.map((value, index) => (
              <div key={index} className="flex-1 rounded-t-md bg-brand/85" style={{ height: `${(value / max) * 100}%` }} />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
            <div>
              <p className="text-2xl font-semibold">62</p>
              <p className="text-xs text-white/50">{t.trips}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">34</p>
              <p className="text-xs text-white/50">{t.hoursOnline}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function CitiesSection({ dict, locale }: SectionProps) {
  const t = dict.site.cities;
  return (
    <section id="cities" className="scroll-mt-16 px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cities.map((city) => {
            const launching = city.launch === "launching";
            return (
              <li
                key={city.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-2xl border p-4",
                  launching ? "border-transparent bg-asphalt text-white" : "border-border bg-card",
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <MapPinIcon className={cn("size-4", launching ? "text-brand" : "text-muted-foreground")} aria-hidden="true" />
                  {city.name[locale]}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
                    launching ? "bg-brand text-asphalt" : "bg-muted text-muted-foreground",
                  )}
                >
                  {launching ? t.launching : t.soon}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function FaqSection({ dict }: SectionProps) {
  const t = dict.site.faq;
  return (
    <section id="faq" className="scroll-mt-16 border-t bg-card px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} />
        <Accordion type="single" collapsible className="w-full">
          {t.items.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`}>
              <AccordionTrigger className="py-5 text-base font-semibold">{item.question}</AccordionTrigger>
              <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function AppCta({ dict, locale }: SectionProps) {
  const t = dict.site.appCta;
  const stores = [
    { top: t.downloadOn, name: t.appStore },
    { top: t.getItOn, name: t.googlePlay },
  ];
  return (
    <section id="app" className="scroll-mt-16 px-4 py-24 sm:px-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-asphalt px-6 py-14 text-center text-white sm:px-12">
        <div className="bg-road-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="absolute -bottom-32 start-1/2 size-[420px] -translate-x-1/2 rounded-full bg-brand/30 blur-[110px] rtl:translate-x-1/2" aria-hidden="true" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{t.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/65 sm:text-lg">{t.subtitle}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {stores.map((store) => (
              <div
                key={store.name}
                className="flex min-w-48 items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-start"
              >
                <SmartphoneIcon className="size-6 text-white/80" aria-hidden="true" />
                <span className="leading-tight">
                  <span className="block text-[0.7rem] text-white/60">{store.top}</span>
                  <span className="block text-base font-semibold">{store.name}</span>
                </span>
                <span className="ms-auto rounded-full bg-brand px-2 py-0.5 text-[0.65rem] font-bold text-asphalt">
                  {dict.common.comingSoon}
                </span>
              </div>
            ))}
          </div>
          <Button asChild variant="link" className="mt-6 text-brand">
            <Link href={`/${locale}/drive`}>
              {dict.site.nav.becomeDriver}
              <ArrowRightIcon className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
