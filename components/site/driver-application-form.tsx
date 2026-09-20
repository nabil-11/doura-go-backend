"use client";

import { CircleCheckBigIcon, MotorbikeIcon, ScooterIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { FieldShell, FormAlert, SubmitButton, TextField, focusFirstInvalid } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitApplicationAction } from "@/lib/actions/applications";
import { vehicleBrands } from "@/lib/config/site";
import { VEHICLE_TYPES } from "@/lib/domain/driver";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { interpolate } from "@/lib/i18n/format";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";

type Props = {
  copy: Dictionary["drivePage"]["form"];
  vehicleTypes: Dictionary["vehicleTypes"];
  messages: Pick<Dictionary, "validation" | "errors">;
  cities: { id: string; name: string }[];
};

const vehicleIcons = { motorcycle: MotorbikeIcon, scooter: ScooterIcon } as const;

export function DriverApplicationForm(props: Props) {
  // Remounting the form is the simplest way to start a fresh application.
  const [round, setRound] = useState(0);
  return <ApplicationForm key={round} {...props} onRestart={() => setRound((value) => value + 1)} />;
}

function ApplicationForm({ copy, vehicleTypes, messages, cities, onRestart }: Props & { onRestart: () => void }) {
  const [state, dispatch, pending] = useActionState<ActionState<{ name: string }>, FormData>(
    submitApplicationAction,
    idleState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (state.status === "error") focusFirstInvalid(formRef.current);
  }, [state]);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center" role="status">
        <span className="grid size-16 place-items-center rounded-full bg-status-good/15 text-status-good">
          <CircleCheckBigIcon className="size-8" aria-hidden="true" />
        </span>
        <h3 className="mt-6 text-2xl font-bold">{copy.successTitle}</h3>
        <p className="mt-3 max-w-sm text-muted-foreground">
          {interpolate(copy.successDescription, { name: state.data?.name ?? "" })}
        </p>
        <Button variant="outline" className="mt-8" onClick={onRestart}>
          {copy.successAgain}
        </Button>
      </div>
    );
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const error = (name: string) => resolveMessage(messages, fieldErrors?.[name]);
  const formError = state.status === "error" && state.error ? resolveMessage(messages, state.error) : undefined;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("elapsed", String(Date.now() - startedAt.current));
    startTransition(() => dispatch(formData));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-8">
      <FormAlert message={formError} />

      {/* Honeypot: invisible to people, tempting for bots */}
      <div aria-hidden="true" className="absolute -start-[9999px] size-0 overflow-hidden opacity-0">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <FieldSet>
        <FieldLegend>{copy.aboutYou}</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="firstName" label={copy.firstName} autoComplete="given-name" required error={error("firstName")} />
          <TextField name="lastName" label={copy.lastName} autoComplete="family-name" required error={error("lastName")} />
          <TextField
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder={copy.phonePlaceholder}
            label={copy.phone}
            required
            error={error("phone")}
            className="text-start rtl:text-end"
          />
          <TextField name="email" type="email" autoComplete="email" label={copy.email} error={error("email")} />
          <FieldShell label={copy.city} error={error("city")} className="sm:col-span-2">
            {(control) => (
              <Select name="city" required>
                <SelectTrigger id={control.id} aria-invalid={control["aria-invalid"]} aria-describedby={control["aria-describedby"]} className="w-full">
                  <SelectValue placeholder={copy.cityPlaceholder} />
                </SelectTrigger>
                <SelectContent position="popper">
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldShell>
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>{copy.yourVehicle}</FieldLegend>
        <Field data-invalid={!!error("vehicleType")}>
          <FieldLabel className="sr-only">{copy.vehicleType}</FieldLabel>
          <RadioGroup name="vehicleType" defaultValue="motorcycle" className="grid grid-cols-2 gap-3" aria-label={copy.vehicleType}>
            {VEHICLE_TYPES.map((type) => {
              const Icon = vehicleIcons[type];
              return (
                <Label
                  key={type}
                  htmlFor={`vehicle-${type}`}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors has-data-[state=checked]:border-brand-deep has-data-[state=checked]:bg-brand/10 dark:has-data-[state=checked]:border-brand"
                >
                  <RadioGroupItem id={`vehicle-${type}`} value={type} />
                  <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{vehicleTypes[type]}</span>
                </Label>
              );
            })}
          </RadioGroup>
          <FieldError>{error("vehicleType")}</FieldError>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="vehicleBrand"
            label={copy.vehicleBrand}
            placeholder={copy.vehicleBrandPlaceholder}
            list="vehicle-brands"
            required
            error={error("vehicleBrand")}
          />
          <datalist id="vehicle-brands">
            {vehicleBrands.map((brand) => (
              <option key={brand} value={brand} />
            ))}
          </datalist>
          <TextField name="vehicleModel" label={copy.vehicleModel} placeholder={copy.vehicleModelPlaceholder} error={error("vehicleModel")} />
          <TextField name="vehicleYear" type="number" inputMode="numeric" min={1980} max={2100} label={copy.vehicleYear} error={error("vehicleYear")} />
          <TextField
            name="plateNumber"
            label={copy.plateNumber}
            placeholder={copy.plateNumberPlaceholder}
            dir="auto"
            className="uppercase placeholder:normal-case"
            error={error("plateNumber")}
          />
          <TextField
            name="licenseNumber"
            label={copy.licenseNumber}
            dir="ltr"
            className="text-start rtl:text-end"
            error={error("licenseNumber")}
            fieldClassName="sm:col-span-2"
          />
        </div>
      </FieldSet>

      <Field orientation="horizontal" data-invalid={!!error("consent")}>
        <Checkbox id="consent" name="consent" aria-invalid={!!error("consent")} />
        <div className="grid gap-1">
          <FieldLabel htmlFor="consent" className="font-normal leading-snug">
            {copy.consent}
          </FieldLabel>
          <FieldError>{error("consent")}</FieldError>
        </div>
      </Field>

      <div className="space-y-3">
        <SubmitButton pending={pending} pendingLabel={copy.submitting} className="h-12 w-full text-base font-semibold">
          {copy.submit}
        </SubmitButton>
        <p className="text-center text-xs text-muted-foreground">{copy.privacy}</p>
      </div>
    </form>
  );
}
