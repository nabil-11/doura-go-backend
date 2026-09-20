import { BanknoteIcon, OctagonAlertIcon } from "lucide-react";

import { PaymentDialog } from "@/components/admin/drivers/payment-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { creditUsage } from "@/lib/domain/pricing";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatCurrency, formatDate, formatPercent, interpolate } from "@/lib/i18n/format";
import type { BalanceState, PaymentEntry } from "@/lib/services/balance";

/**
 * What a driver owes Doura Go, and the line they can't cross.
 *
 * Cash rides leave the fare with the driver, so the commission is a debt that
 * grows with every trip. The bar is the whole story at a glance: how close they
 * are to the limit that takes them off the road.
 */
export function BalanceCard({
  driverId,
  driverName,
  balance,
  payments,
  canSettle,
  dict,
  locale,
}: {
  driverId: string;
  driverName: string;
  balance: BalanceState;
  payments: PaymentEntry[];
  canSettle: boolean;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.admin.drivers.balance;
  const money = (value: number) => formatCurrency(locale, value, balance.currency);
  const usage = creditUsage(balance.commissionDue, balance.limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BanknoteIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t.due}</p>
            <p className="tabular mt-1 text-3xl font-semibold">{money(balance.commissionDue)}</p>
          </div>
          {balance.limit > 0 ? (
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{t.limit}</p>
              <p className="tabular mt-1 text-lg font-medium">{money(balance.limit)}</p>
            </div>
          ) : null}
        </div>

        {balance.limit > 0 ? (
          <div className="space-y-2">
            <Progress
              value={usage * 100}
              aria-label={t.limit}
              className={balance.blocked ? "[&>*]:bg-status-critical" : usage > 0.75 ? "[&>*]:bg-status-warning" : undefined}
            />
            <p className="text-xs text-muted-foreground">
              {balance.blocked
                ? formatPercent(locale, usage)
                : interpolate(t.remaining, { amount: money(balance.remaining) })}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t.noLimit}</p>
        )}

        {balance.blocked ? (
          <p className="flex items-start gap-2 rounded-lg bg-status-critical/10 px-3 py-2.5 text-sm">
            <OctagonAlertIcon className="mt-0.5 size-4 shrink-0 text-status-critical" aria-hidden="true" />
            <span>
              <span className="font-medium">{t.blocked}</span> — {t.blockedHint}
            </span>
          </p>
        ) : null}

        {canSettle && balance.commissionDue > 0 ? (
          <PaymentDialog
            driverId={driverId}
            driverName={driverName}
            due={balance.commissionDue}
            currency={balance.currency}
          />
        ) : null}

        <dl className="grid gap-x-4 gap-y-2 border-t pt-4 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-xs text-muted-foreground">{t.paidTotal}</dt>
            <dd className="tabular font-medium">{money(balance.paidTotal)}</dd>
          </div>
          {balance.lastPaymentAt ? (
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-xs text-muted-foreground">{t.history}</dt>
              <dd className="font-medium">
                {interpolate(t.lastPayment, { date: formatDate(locale, balance.lastPaymentAt) })}
              </dd>
            </div>
          ) : null}
        </dl>

        {payments.length ? (
          <ul className="space-y-2.5 border-t pt-4">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{t.channels[payment.channel]}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatDate(locale, payment.createdAt)}
                    {payment.recordedByName
                      ? ` · ${interpolate(t.recordedBy, { name: payment.recordedByName })}`
                      : ""}
                  </span>
                  {payment.reference ? (
                    <span className="block truncate text-xs text-muted-foreground">{payment.reference}</span>
                  ) : null}
                </span>
                <span className="tabular shrink-0 font-medium">−{money(payment.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t pt-4 text-sm text-muted-foreground">{t.noHistory}</p>
        )}
      </CardContent>
    </Card>
  );
}
