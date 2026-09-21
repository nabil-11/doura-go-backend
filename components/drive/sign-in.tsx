"use client";

import { ArrowLeftIcon, MessageSquareTextIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { requestCode, verifyCode } from "@/lib/drive/api";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/format";

import { CenteredStage, Notice, messageFor, type DriveCopy } from "./shell";

/** How long before a new code can be asked for. */
const RESEND_SECONDS = 45;

/**
 * Phone, then the code. There is no third step: a driver account is created by
 * the team from an application they already vetted, so an unknown number is
 * turned away here rather than signed up — and pointed at the form instead.
 *
 * Nothing is kept once it works: `POST /auth/web/driver` sets an httpOnly
 * cookie, and that cookie is the session. The browser never sees a token, so
 * there is nothing for this screen to store.
 */
export function SignIn({
  copy,
  locale,
  onSignedIn,
}: {
  copy: DriveCopy;
  locale: Locale;
  onSignedIn: () => void;
}) {
  const t = copy.auth;
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  const digits = phone.replace(/[^0-9]/g, "");
  const phoneReady = digits.length >= 8;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function sendCode() {
    if (!phoneReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestCode(digits);
      // Only ever present off production, and only while no SMS provider is
      // wired up — otherwise the driver reads it off their own phone.
      setDevCode(result.debugCode ?? null);
      setCountdown(RESEND_SECONDS);
      setCode("");
      setStep("code");
      window.setTimeout(() => codeInput.current?.focus(), 120);
    } catch (failure) {
      setError(messageFor(copy, failure));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(digits, value);
      onSignedIn();
    } catch (failure) {
      setError(messageFor(copy, failure));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  function onCodeChange(raw: string) {
    const next = raw.replace(/[^0-9]/g, "").slice(0, 6);
    setCode(next);
    // Six digits is the whole answer; asking for a tap as well is busywork.
    if (next.length === 6 && !busy) void submitCode(next);
  }

  return (
    <CenteredStage>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo tone="light" className="mx-auto" />
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{t.welcome}</h1>
          <p className="mt-2 text-white/60">{t.tagline}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:p-6">
          {step === "code" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setStep("phone");
              }}
              disabled={busy}
              className="-ms-2 mb-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeftIcon className="rtl:rotate-180" />
              {t.changeNumber}
            </Button>
          ) : null}

          {step === "phone" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendCode();
              }}
              noValidate
            >
              <h2 className="text-lg font-semibold">{t.phoneTitle}</h2>
              <p className="mt-1 text-sm text-white/60">{t.phoneSubtitle}</p>
              <Label htmlFor="dg-driver-phone" className="mt-5 block text-white/80">
                {t.phoneLabel}
              </Label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/15 bg-black/20 px-3 focus-within:border-brand">
                <span dir="ltr" className="shrink-0 text-sm font-medium text-white/60">
                  +216
                </span>
                <Input
                  id="dg-driver-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  maxLength={12}
                  placeholder={t.phonePlaceholder}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="h-11 border-0 bg-transparent px-0 text-start text-base text-white placeholder:text-white/35 focus-visible:ring-0 rtl:text-end"
                />
              </div>
              <Notice message={error} className="mt-4 bg-destructive/20 text-destructive-foreground" />
              <Button type="submit" disabled={!phoneReady || busy} className="mt-5 h-12 w-full text-base font-semibold">
                {busy ? <Spinner aria-hidden="true" /> : null}
                {t.sendCode}
              </Button>
              <p className="mt-4 text-center text-xs text-white/45">{t.terms}</p>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitCode(code);
              }}
              noValidate
            >
              <h2 className="text-lg font-semibold">{t.codeTitle}</h2>
              <p className="mt-1 text-sm text-white/60">
                {interpolate(t.codeSubtitle, { phone: `+216 ${digits}` })}
              </p>
              <Label htmlFor="dg-driver-code" className="mt-5 block text-white/80">
                {t.codeLabel}
              </Label>
              <Input
                id="dg-driver-code"
                ref={codeInput}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
                className="mt-2 h-14 border-white/15 bg-black/20 text-center font-mono text-2xl tracking-[0.4em] text-white placeholder:text-white/25"
              />
              {devCode ? (
                <p className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-brand/15 px-3 py-2 text-sm text-brand">
                  <MessageSquareTextIcon className="size-4" aria-hidden="true" />
                  <span dir="ltr">{interpolate(t.devCode, { code: devCode })}</span>
                </p>
              ) : null}
              <Notice message={error} className="mt-4 bg-destructive/20 text-destructive-foreground" />
              <Button
                type="submit"
                disabled={code.length !== 6 || busy}
                className="mt-5 h-12 w-full text-base font-semibold"
              >
                {busy ? <Spinner aria-hidden="true" /> : null}
                {t.verify}
              </Button>
              <Button
                type="button"
                variant="link"
                disabled={countdown > 0 || busy}
                onClick={() => void sendCode()}
                className="mt-2 h-auto w-full text-white/60 hover:text-white"
              >
                {countdown > 0 ? interpolate(t.resendIn, { seconds: countdown }) : t.resend}
              </Button>
            </form>
          )}
        </div>

        {/* The only way out of a refused number that leads anywhere. */}
        <p className="mt-6 text-center text-sm text-white/50">
          {t.notDriver}{" "}
          <Link
            href={`/${locale}/drive`}
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            {t.apply}
          </Link>
        </p>
      </div>
    </CenteredStage>
  );
}
