"use client";

import { LogOutIcon, StarIcon } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { updateProfile, type DriverProfile } from "@/lib/drive/api";
import type { Locale } from "@/lib/i18n/config";
import { formatDate, formatNumber, formatPhone, initials, interpolate } from "@/lib/i18n/format";

import { Notice, Page, messageFor, type CommonCopy, type DriveCopy } from "./shell";

/**
 * The driver's own record, and the way out.
 *
 * Almost all of it is read-only. A driver's name, plate and licence come from
 * documents the team checked, so changing one here would only put the app and
 * the file out of step — the email is theirs, and the rest goes through the
 * office.
 */
export function AccountScreen({
  copy,
  common,
  locale,
  driver,
  onDriver,
  onSignOut,
}: {
  copy: DriveCopy;
  common: CommonCopy;
  locale: Locale;
  driver: DriverProfile;
  onDriver: (driver: DriverProfile) => void;
  onSignOut: () => void;
}) {
  const t = copy.account;
  const [email, setEmail] = useState(driver.email ?? "");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const dirty = (email.trim() || null) !== driver.email;
  const name = `${driver.firstName} ${driver.lastName}`.trim();
  const vehicle = [driver.vehicle.brand, driver.vehicle.model, driver.vehicle.year]
    .filter(Boolean)
    .join(" · ");

  async function save() {
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const result = await updateProfile({ email: email.trim() || null });
      onDriver(result.driver);
      setNote(t.saved);
    } catch (caught) {
      setError(messageFor(copy, caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={t.title}>
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/15 text-lg font-bold text-brand-deep">
          {driver.photoUrl ? (
            // The photo is whatever the team put on file; no crop is promised.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={driver.photoUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(name)
          )}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{name}</h2>
          <p dir="ltr" className="text-sm text-muted-foreground">
            {formatPhone(driver.phone)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xl font-bold tabular-nums">
            <StarIcon className="size-4 fill-brand text-brand" aria-hidden="true" />
            {driver.rating.count
              ? formatNumber(locale, driver.rating.average, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t.rating}</p>
        </div>
        <div className="rounded-xl border p-4 text-center">
          <p className="text-xl font-bold tabular-nums">
            {formatNumber(locale, driver.stats.completedRides)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t.ridesDone}</p>
        </div>
      </div>

      <section className="rounded-xl border">
        <h2 className="border-b px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t.vehicle}
        </h2>
        <dl className="divide-y">
          <Row label={t.vehicle} value={vehicle || "—"} />
          <Row label={t.plate} value={driver.vehicle.plateNumber ?? "—"} mono />
          <Row
            label={t.licence}
            value={driver.license.number ?? "—"}
            mono
            note={
              driver.license.expiresAt
                ? interpolate(t.expires, { date: formatDate(locale, driver.license.expiresAt) })
                : undefined
            }
          />
        </dl>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.profile}</h2>
        <Label htmlFor="dg-driver-email" className="mt-3 block">
          {t.email}
        </Label>
        <Input
          id="dg-driver-email"
          type="email"
          inputMode="email"
          dir="ltr"
          autoComplete="email"
          maxLength={160}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 h-11"
        />
        <p className="mt-2 text-xs text-muted-foreground">{t.nameLocked}</p>

        <Notice message={error} className="mt-3" />
        {note ? <p className="mt-3 text-sm font-medium text-brand-deep">{note}</p> : null}

        {dirty ? (
          <Button onClick={() => void save()} disabled={saving} className="mt-3 h-11 w-full font-semibold">
            {saving ? <Spinner aria-hidden="true" /> : null}
            {saving ? common.saving : common.save}
          </Button>
        ) : null}
      </section>

      <Button
        type="button"
        variant="ghost"
        onClick={() => setConfirming(true)}
        className="h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOutIcon className="rtl:rotate-180" aria-hidden="true" />
        {t.signOut}
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.signOutTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.signOutBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
            <Button variant="destructive" onClick={onSignOut}>
              {t.signOut}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

function Row({
  label,
  value,
  note,
  mono = false,
}: {
  label: string;
  value: string;
  note?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end">
        <span className={mono ? "block truncate font-mono text-sm tracking-wider" : "block truncate text-sm font-medium"} dir={mono ? "ltr" : undefined}>
          {value}
        </span>
        {note ? <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span> : null}
      </dd>
    </div>
  );
}
