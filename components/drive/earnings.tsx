"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { DriverBalance, Earnings } from "@/lib/drive/api";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrency, formatDate, formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { CashBar } from "./home";
import { Notice, Page, type DriveCopy } from "./shell";

/**
 * What the driver has made, and what they owe.
 *
 * The two belong on the same screen: on cash rides the money in their pocket
 * and the commission building up behind it are the same transaction seen from
 * two ends.
 */
export function EarningsScreen({
  copy,
  locale,
  earnings,
  balance,
  error,
}: {
  copy: DriveCopy;
  locale: Locale;
  earnings: Earnings | null;
  balance: DriverBalance;
  error: string | null;
}) {
  const t = copy.earnings;
  const usage = balance.limit > 0 ? Math.min(1, balance.cashCollected / balance.limit) : 0;

  return (
    <Page title={t.title}>
      <Notice message={error} />

      <section className="rounded-2xl bg-asphalt p-5 text-white">
        <p className="text-xs tracking-wide text-white/55 uppercase">{t.today}</p>
        {earnings ? (
          <>
            <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">
              {formatCurrency(locale, earnings.today.earnings, earnings.currency)}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {interpolate(t.rides, { count: formatNumber(locale, earnings.today.rides) })}
            </p>
          </>
        ) : (
          <Skeleton className="mt-2 h-10 w-40 bg-white/15" />
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Figure
          label={t.week}
          value={earnings ? formatCurrency(locale, earnings.last7Days.earnings, earnings.currency) : null}
          note={
            earnings ? interpolate(t.rides, { count: formatNumber(locale, earnings.last7Days.rides) }) : null
          }
        />
        <Figure
          label={t.allTime}
          value={earnings ? formatCurrency(locale, earnings.allTime.earnings, earnings.currency) : null}
          note={
            earnings ? interpolate(t.rides, { count: formatNumber(locale, earnings.allTime.rides) }) : null
          }
        />
      </div>

      <section
        className={cn(
          "rounded-2xl border p-5",
          balance.blocked && "border-destructive/40 bg-destructive/5",
        )}
      >
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.balance}</h2>
        <p
          className={cn(
            "mt-1 text-3xl font-extrabold tracking-tight tabular-nums",
            balance.blocked && "text-destructive",
          )}
        >
          {formatCurrency(locale, balance.cashCollected, balance.currency)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {interpolate(t.dueOnIt, {
            amount: formatCurrency(locale, balance.commissionDue, balance.currency),
          })}
        </p>

        {balance.limit > 0 ? (
          <>
            <CashBar usage={usage} label={t.balance} className="mt-4" />
            <p className="mt-2 text-xs text-muted-foreground">
              {interpolate(t.limit, { amount: formatCurrency(locale, balance.limit, balance.currency) })}
              {" · "}
              {interpolate(t.remaining, {
                amount: formatCurrency(locale, balance.remaining, balance.currency),
              })}
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">{t.noLimit}</p>
        )}

        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{t.balanceHint}</p>

        <dl className="mt-3 flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">{t.settled}</dt>
          <dd className="font-semibold tabular-nums">
            {formatCurrency(locale, balance.paidTotal, balance.currency)}
          </dd>
        </dl>
        {/* One sentence rather than a label and a value: every language puts
            its own word between the two. */}
        {balance.lastPaymentAt ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {interpolate(t.lastPayment, { date: formatDate(locale, balance.lastPaymentAt) })}
          </p>
        ) : null}
      </section>
    </Page>
  );
}

function Figure({ label, value, note }: { label: string; value: string | null; note: string | null }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {value ? (
        <>
          <p className="mt-1 text-xl font-bold tracking-tight tabular-nums">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
        </>
      ) : (
        <Skeleton className="mt-2 h-6 w-24" />
      )}
    </div>
  );
}
