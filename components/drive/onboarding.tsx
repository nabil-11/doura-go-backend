"use client";

import { CheckCircle2Icon, CircleIcon, CircleXIcon, HourglassIcon, PauseCircleIcon } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DriverProfile } from "@/lib/drive/api";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { CenteredStage, type DriveCopy } from "./shell";

/**
 * The screen a driver sees before they can work.
 *
 * Waiting is easier when you can see exactly what is missing, so the checklist
 * is the same one the team reviews — and a refusal comes with its reason
 * rather than a dead end.
 */
export function Onboarding({
  copy,
  locale,
  driver,
  onRecheck,
  onSignOut,
}: {
  copy: DriveCopy;
  locale: Locale;
  driver: DriverProfile;
  onRecheck: () => Promise<void>;
  onSignOut: () => void;
}) {
  const t = copy.onboarding;
  const [checking, setChecking] = useState(false);

  const rejected = driver.status === "rejected";
  const suspended = driver.status === "suspended";
  const title = rejected ? t.rejectedTitle : suspended ? t.suspendedTitle : t.pendingTitle;
  const Mark = rejected ? CircleXIcon : suspended ? PauseCircleIcon : HourglassIcon;

  const items = [
    { ok: driver.onboarding.documents, label: t.documents },
    { ok: driver.onboarding.license, label: t.license },
    { ok: driver.onboarding.vehicle, label: t.vehicle },
  ];

  const names = t.docNames as Record<string, string>;
  // Arabic lists are separated by its own comma; the other two by a plain one.
  const missing = driver.onboarding.missingDocuments
    .map((kind) => names[kind] ?? kind)
    .join(locale === "ar" ? "، " : ", ");

  async function check() {
    setChecking(true);
    try {
      await onRecheck();
    } finally {
      setChecking(false);
    }
  }

  return (
    <CenteredStage>
      <div className="w-full max-w-md text-center">
        <Logo tone="light" className="mx-auto" />

        <Mark
          className={cn(
            "mx-auto mt-8 size-12",
            rejected ? "text-destructive" : suspended ? "text-amber-400" : "text-brand",
          )}
          aria-hidden="true"
        />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>

        {driver.onboarding.reviewReason ? (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-start text-sm text-white/80">
            <strong className="font-semibold">{t.reason}:</strong> {driver.onboarding.reviewReason}
          </p>
        ) : (
          <p className="mt-3 text-white/60">{t.pendingBody}</p>
        )}

        {!rejected && !suspended ? (
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-start">
            <h2 className="text-xs font-medium tracking-wide text-white/50 uppercase">{t.checklist}</h2>
            <ul className="mt-3 space-y-2.5">
              {items.map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-sm">
                  {item.ok ? (
                    <CheckCircle2Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                  ) : (
                    <CircleIcon className="size-5 shrink-0 text-white/25" aria-hidden="true" />
                  )}
                  <span className={item.ok ? "text-white" : "text-white/60"}>{item.label}</span>
                </li>
              ))}
            </ul>
            {missing ? (
              <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/55">
                {interpolate(t.missing, { items: missing })}
              </p>
            ) : null}
          </section>
        ) : null}

        <Button onClick={() => void check()} disabled={checking} className="mt-6 h-12 w-full text-base font-semibold">
          {checking ? <Spinner aria-hidden="true" /> : null}
          {t.refresh}
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={onSignOut}
          className="mt-1 h-auto w-full text-white/50 hover:text-white"
        >
          {copy.account.signOut}
        </Button>
      </div>
    </CenteredStage>
  );
}
