"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { FieldShell, FormAlert, SubmitButton, focusFirstInvalid, useFormAction } from "@/components/shared/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { updatePricingAction } from "@/lib/actions/backoffice";
import { estimateFare, type PricingValues } from "@/lib/domain/pricing";
import { formatCurrency, formatNumber, interpolate } from "@/lib/i18n/format";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";

type NumericKey = Exclude<keyof PricingValues, "currency">;

const TRIPS = [
  { id: "short", distance: 3, duration: 9 },
  { id: "typical", distance: 6, duration: 16 },
  { id: "long", distance: 12, duration: 28 },
] as const;

export function PricingForm({ initial, canEdit }: { initial: PricingValues; canEdit: boolean }) {
  const dict = useDictionary();
  const locale = useLocale();
  const t = dict.admin.pricing;
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction<ActionState>(updatePricingAction, idleState);
  const [values, setValues] = useState(initial);
  const [tripId, setTripId] = useState<(typeof TRIPS)[number]["id"]>("typical");

  useEffect(() => {
    if (state.status === "success") toast.success(t.saved);
    else if (state.status === "error") focusFirstInvalid(formRef.current);
  }, [state, t.saved]);

  const trip = TRIPS.find((item) => item.id === tripId) ?? TRIPS[1];
  const fare = useMemo(() => estimateFare(values, trip.distance, trip.duration), [values, trip]);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const formError = state.status === "error" && state.error ? resolveMessage(dict, state.error) : undefined;
  const money = (value: number) => formatCurrency(locale, value, values.currency);

  function field(key: NumericKey, label: string, suffix: string, step: string) {
    return (
      <FieldShell label={label} error={resolveMessage(dict, fieldErrors?.[key])}>
        {(control) => (
          <InputGroup>
            <InputGroupInput
              {...control}
              name={key}
              type="number"
              inputMode="decimal"
              min={0}
              step={step}
              dir="ltr"
              disabled={!canEdit}
              defaultValue={initial[key]}
              onChange={(event) => {
                const next = Number(event.target.value);
                setValues((current) => ({ ...current, [key]: Number.isFinite(next) ? next : 0 }));
              }}
              className="tabular text-start rtl:text-end"
            />
            <InputGroupAddon align="inline-end">{suffix}</InputGroupAddon>
          </InputGroup>
        )}
      </FieldShell>
    );
  }

  const currency = values.currency;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        <FormAlert message={formError} />
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t.fares}</CardTitle>
            <CardDescription>{interpolate(t.faresHint, { currency })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {field("baseFare", t.baseFare, currency, "0.05")}
            {field("perKm", t.perKm, `${currency}/km`, "0.01")}
            {field("perMinute", t.perMinute, `${currency}/min`, "0.01")}
            {field("minimumFare", t.minimumFare, currency, "0.1")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t.commissionSection}</CardTitle>
            <CardDescription>{t.commissionHint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            {field("commissionRate", t.commissionRate, "%", "0.5")}
            {field("bookingFee", t.bookingFee, currency, "0.05")}
            {field("cancellationFee", t.cancellationFee, currency, "0.1")}
          </CardContent>
        </Card>
        {canEdit ? (
          <div className="flex justify-end">
            <SubmitButton pending={pending} pendingLabel={dict.common.saving} className="min-w-40">
              {t.save}
            </SubmitButton>
          </div>
        ) : null}
      </form>

      <Card className="h-fit bg-asphalt text-white ring-transparent lg:sticky lg:top-20 dark:bg-asphalt-2">
        <CardHeader>
          <CardTitle className="text-white">{t.preview.title}</CardTitle>
          <CardDescription className="text-white/60">{t.preview.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ToggleGroup
            type="single"
            value={tripId}
            onValueChange={(value) => value && setTripId(value as typeof tripId)}
            className="w-full"
            variant="outline"
            size="sm"
          >
            {TRIPS.map((item) => (
              <ToggleGroupItem
                key={item.id}
                value={item.id}
                className="flex-1 border-white/15 text-white/70 hover:bg-white/10 hover:text-white data-[state=on]:bg-brand data-[state=on]:text-asphalt"
              >
                {interpolate(dict.common.kilometersShort, { count: formatNumber(locale, item.distance) })}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-white/50">{t.preview.distance}</p>
              <p className="mt-1 font-semibold">{interpolate(dict.common.kilometersShort, { count: formatNumber(locale, trip.distance) })}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-white/50">{t.preview.duration}</p>
              <p className="mt-1 font-semibold">{interpolate(dict.common.minutesShort, { count: formatNumber(locale, trip.duration) })}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-white/60">{t.preview.riderPays}</p>
            <p className="mt-1 text-4xl font-bold text-brand">{money(fare.total)}</p>
          </div>
          <Separator className="bg-white/10" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-white/60">{t.preview.commission}</dt>
              <dd className="tabular font-medium">{money(fare.commission)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/60">{t.preview.driverEarns}</dt>
              <dd className="tabular font-medium">{money(fare.driverEarnings)}</dd>
            </div>
          </dl>
          <p className="text-xs text-white/45">{interpolate(t.preview.rounding, { currency })}</p>
        </CardContent>
      </Card>
    </div>
  );
}
