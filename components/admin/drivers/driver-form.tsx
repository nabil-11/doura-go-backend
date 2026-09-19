"use client";

import { BadgeCheckIcon, HourglassIcon, MotorbikeIcon, ScooterIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { FieldShell, FormAlert, SubmitButton, TextField, focusFirstInvalid, useFormAction } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDriverAction, updateDriverAction } from "@/lib/actions/drivers";
import { cities, vehicleBrands } from "@/lib/config/site";
import { DOCUMENT_KINDS, REQUIRED_DOCUMENTS, VEHICLE_TYPES, type VehicleType } from "@/lib/domain/driver";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

import { FileField } from "./file-field";

export type DriverFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  city: string;
  address: string;
  nationalId: string;
  licenseNumber: string;
  licenseExpiry: string;
  vehicleType: VehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  plateNumber: string;
};

const vehicleIcons = { motorcycle: MotorbikeIcon, scooter: ScooterIcon } as const;

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type Props =
  | { mode: "create"; driverId?: undefined; defaults?: undefined }
  | { mode: "edit"; driverId: string; defaults: DriverFormValues };

export function DriverForm(props: Props) {
  const dict = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const t = dict.admin.drivers.form;

  const action =
    props.mode === "create"
      ? createDriverAction
      : (updateDriverAction.bind(null, props.driverId) as (
          state: ActionState<{ id: string }>,
          formData: FormData,
        ) => Promise<ActionState<{ id: string }>>);
  const { state, pending, onSubmit } = useFormAction<ActionState<{ id: string }>>(action, idleState);
  const values = props.defaults;

  useEffect(() => {
    if (state.status === "success") {
      toast.success(props.mode === "create" ? t.created : t.updated);
      const id = props.mode === "create" ? state.data?.id : props.driverId;
      if (id) router.push(`/${locale}/admin/drivers/${id}`);
    } else if (state.status === "error") {
      focusFirstInvalid(formRef.current);
    }
  }, [state, props.mode, props.driverId, locale, router, t.created, t.updated]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const error = (name: string) => resolveMessage(dict, fieldErrors?.[name]);
  const formError = state.status === "error" && state.error ? resolveMessage(dict, state.error) : undefined;
  const backHref = props.mode === "edit" ? `/${locale}/admin/drivers/${props.driverId}` : `/${locale}/admin/drivers`;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert message={formError} />

      <Section title={t.personal} description={t.personalHint}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="firstName" label={t.firstName} defaultValue={values?.firstName} required error={error("firstName")} />
          <TextField name="lastName" label={t.lastName} defaultValue={values?.lastName} required error={error("lastName")} />
          <TextField
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="+216 22 123 456"
            label={t.phone}
            defaultValue={values?.phone}
            required
            error={error("phone")}
            className="text-start rtl:text-end"
          />
          <TextField name="email" type="email" dir="ltr" label={t.email} defaultValue={values?.email} error={error("email")} className="text-start rtl:text-end" />
          <TextField name="dateOfBirth" type="date" label={t.dateOfBirth} defaultValue={values?.dateOfBirth} error={error("dateOfBirth")} />
          <FieldShell label={t.city} error={error("city")}>
            {(control) => (
              <Select name="city" defaultValue={values?.city}>
                <SelectTrigger {...control} className="w-full">
                  <SelectValue placeholder={t.cityPlaceholder} />
                </SelectTrigger>
                <SelectContent position="popper">
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name[locale]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldShell>
          <TextField name="address" label={t.address} defaultValue={values?.address} error={error("address")} fieldClassName="sm:col-span-2" />
          <TextField name="nationalId" label={t.nationalId} dir="ltr" defaultValue={values?.nationalId} error={error("nationalId")} className="text-start rtl:text-end" />
        </div>
      </Section>

      <Section title={t.license} description={t.licenseHint}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="licenseNumber" label={t.licenseNumber} dir="ltr" defaultValue={values?.licenseNumber} error={error("licenseNumber")} className="text-start rtl:text-end" />
          <TextField name="licenseExpiry" type="date" label={t.licenseExpiry} defaultValue={values?.licenseExpiry} error={error("licenseExpiry")} />
        </div>
      </Section>

      <Section title={t.vehicle} description={t.vehicleHint}>
        <div className="space-y-5">
          <RadioGroup
            name="vehicleType"
            defaultValue={values?.vehicleType ?? "motorcycle"}
            className="grid grid-cols-2 gap-3 sm:max-w-md"
            aria-label={t.vehicleType}
          >
            {VEHICLE_TYPES.map((type) => {
              const Icon = vehicleIcons[type];
              return (
                <Label
                  key={type}
                  htmlFor={`vehicle-type-${type}`}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-data-[state=checked]:border-brand-deep has-data-[state=checked]:bg-brand/10 dark:has-data-[state=checked]:border-brand"
                >
                  <RadioGroupItem id={`vehicle-type-${type}`} value={type} />
                  <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{dict.vehicleTypes[type]}</span>
                </Label>
              );
            })}
          </RadioGroup>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <TextField name="vehicleBrand" label={t.vehicleBrand} list="driver-vehicle-brands" defaultValue={values?.vehicleBrand} error={error("vehicleBrand")} />
            <datalist id="driver-vehicle-brands">
              {vehicleBrands.map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
            <TextField name="vehicleModel" label={t.vehicleModel} defaultValue={values?.vehicleModel} error={error("vehicleModel")} />
            <TextField name="vehicleYear" type="number" inputMode="numeric" min={1980} max={2100} label={t.vehicleYear} defaultValue={values?.vehicleYear} error={error("vehicleYear")} />
            <TextField name="vehicleColor" label={t.vehicleColor} defaultValue={values?.vehicleColor} error={error("vehicleColor")} />
            <TextField name="plateNumber" label={t.plateNumber} dir="auto" placeholder="123 TU 4567" defaultValue={values?.plateNumber} error={error("plateNumber")} className="uppercase" />
          </div>
        </div>
      </Section>

      {props.mode === "create" ? (
        <>
          <Section title={t.documents} description={t.documentsHint}>
            <div className="grid gap-5 sm:grid-cols-2">
              {DOCUMENT_KINDS.map((kind) => (
                <FileField
                  key={kind}
                  name={`doc_${kind}`}
                  label={dict.admin.drivers.documents[kind]}
                  accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"}
                  required={REQUIRED_DOCUMENTS.includes(kind)}
                  requiredLabel={dict.admin.drivers.documents.required}
                  hint={dict.admin.drivers.documents.upload}
                  error={error(`doc_${kind}`)}
                  labels={{
                    remove: dict.common.delete,
                    tooLarge: dict.validation.fileTooLarge,
                    badType: dict.validation.fileType,
                    selected: dict.admin.drivers.documents.selected,
                  }}
                />
              ))}
            </div>
          </Section>

          <Section title={t.statusSection} description={t.statusHint}>
            <RadioGroup name="initialStatus" defaultValue="pending" className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: "pending", title: t.initialPending, hint: t.initialPendingHint, icon: HourglassIcon },
                  { value: "active", title: t.initialActive, hint: t.initialActiveHint, icon: BadgeCheckIcon },
                ] as const
              ).map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`initial-${option.value}`}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-data-[state=checked]:border-brand-deep has-data-[state=checked]:bg-brand/10 dark:has-data-[state=checked]:border-brand"
                >
                  <RadioGroupItem id={`initial-${option.value}`} value={option.value} className="mt-0.5" />
                  <span className="grid gap-1">
                    <span className="flex items-center gap-2 font-medium">
                      <option.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {option.title}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">{option.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </Section>
        </>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button asChild variant="ghost">
          <Link href={backHref}>{dict.common.cancel}</Link>
        </Button>
        <SubmitButton pending={pending} pendingLabel={dict.common.saving} className={cn("min-w-36")}>
          {props.mode === "create" ? t.submitCreate : t.submitEdit}
        </SubmitButton>
      </div>
    </form>
  );
}
