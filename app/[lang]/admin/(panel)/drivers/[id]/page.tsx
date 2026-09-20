import {
  CalendarDaysIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  InfoIcon,
  MapPinIcon,
  MotorbikeIcon,
  PhoneIcon,
  ScooterIcon,
  StarIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/admin/access-denied";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { DocumentTile } from "@/components/admin/drivers/document-tile";
import { BalanceCard } from "@/components/admin/drivers/balance-card";
import { DriverStatusActions } from "@/components/admin/drivers/driver-status-actions";
import { NoteForm } from "@/components/admin/drivers/note-form";
import { BackLink } from "@/components/admin/page-header";
import { AvailabilityIndicator, DriverStatusBadge } from "@/components/admin/status-badge";
import { MapView } from "@/components/map/map-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { cityName } from "@/lib/config/site";
import { DOCUMENT_KINDS, REQUIRED_DOCUMENTS, ageFrom } from "@/lib/domain/driver";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPhone,
  formatRelative,
  initials,
  interpolate,
} from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { listActivityFor } from "@/lib/services/activity";
import { balanceState, listDriverPayments } from "@/lib/services/balance";
import { getDriver } from "@/lib/services/drivers";
import { requestTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/drivers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [dict, driver] = await Promise.all([getDictionary(), getDriver(id)]);
  return { title: driver?.name ?? dict.admin.drivers.title };
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export default async function DriverPage({ params }: PageProps<"/[lang]/admin/drivers/[id]">) {
  const { id } = await params;
  const [admin, dict, locale] = await Promise.all([requireAdmin(), getDictionary(), getLocale()]);
  if (!can(admin.role, "drivers:view")) return <AccessDenied dict={dict} />;

  const [driver, activity, payments] = await Promise.all([
    getDriver(id),
    listActivityFor("driver", id).catch(() => []),
    listDriverPayments(id).catch(() => []),
  ]);
  if (!driver) notFound();

  const balance = await balanceState(driver);

  const t = dict.admin.drivers;
  const now = requestTime();
  const notSet = <span className="font-normal text-muted-foreground">{dict.common.notSet}</span>;
  const age = ageFrom(driver.dateOfBirth);
  const VehicleIcon = driver.vehicle.type === "scooter" ? ScooterIcon : MotorbikeIcon;
  const permissions = {
    manage: can(admin.role, "drivers:manage"),
    review: can(admin.role, "drivers:review"),
    remove: can(admin.role, "drivers:delete"),
  };
  const licenseExpired = driver.license.expiresAt ? driver.license.expiresAt.getTime() <= now : false;
  const checklistItems = [
    { key: "documents", ok: driver.checklist.documents, label: t.detail.checklist.documents },
    { key: "license", ok: driver.checklist.license, label: t.detail.checklist.license },
    { key: "vehicle", ok: driver.checklist.vehicle, label: t.detail.checklist.vehicle },
  ];

  return (
    <div className="space-y-6">
      <BackLink href={`/${locale}/admin/drivers`} label={t.detail.back} />

      {/* Identity + actions */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="h-20 bg-asphalt bg-road-grid" aria-hidden="true" />
        <div className="flex flex-col gap-5 px-6 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar className="-mt-10 size-20 rounded-2xl ring-4 ring-card after:rounded-2xl">
              {driver.photoUrl ? <AvatarImage src={driver.photoUrl} alt="" className="rounded-2xl" /> : null}
              <AvatarFallback className="rounded-2xl bg-brand text-2xl font-bold text-asphalt">
                {initials(driver.name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{driver.name}</h1>
                <DriverStatusBadge status={driver.status} label={dict.admin.statuses.driver[driver.status]} />
                {driver.status === "active" ? (
                  <AvailabilityIndicator availability={driver.availability} label={t.availability[driver.availability]} />
                ) : null}
              </div>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <PhoneIcon className="size-3.5" aria-hidden="true" />
                  <a href={`tel:${driver.phone}`} className="ltr-nums hover:text-foreground">
                    {formatPhone(driver.phone)}
                  </a>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="size-3.5" aria-hidden="true" />
                  {cityName(driver.city, locale)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
                  {driver.approvedAt
                    ? interpolate(t.detail.memberSince, { date: formatDate(locale, driver.approvedAt) })
                    : interpolate(t.detail.appliedOn, { date: formatDate(locale, driver.createdAt) })}
                </span>
                <span>
                  {t.detail.source}: {t.source[driver.source]}
                </span>
              </p>
            </div>
          </div>
          <DriverStatusActions
            driver={{ id: driver.id, name: driver.name, status: driver.status }}
            checklistReady={driver.checklist.ready}
            permissions={permissions}
          />
        </div>
      </Card>

      {driver.review?.reason && (driver.status === "rejected" || driver.status === "suspended") ? (
        <Alert className="border-status-serious/40 bg-status-serious/10">
          <InfoIcon />
          <AlertTitle>
            {dict.admin.statuses.driver[driver.status]}
            {driver.review.at ? ` · ${formatDate(locale, driver.review.at)}` : ""}
          </AlertTitle>
          <AlertDescription>
            {t.detail.reason}: {driver.review.reason}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.detail.profile}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label={t.form.phone}>
                  <span className="ltr-nums">{formatPhone(driver.phone)}</span>
                </Detail>
                <Detail label={t.form.email}>{driver.email ?? notSet}</Detail>
                <Detail label={t.form.dateOfBirth}>
                  {driver.dateOfBirth ? (
                    <>
                      {formatDate(locale, driver.dateOfBirth, { dateStyle: "medium", timeZone: "UTC" })}
                      {age !== null ? (
                        <span className="text-muted-foreground"> · {interpolate(t.detail.age, { count: age })}</span>
                      ) : null}
                    </>
                  ) : (
                    notSet
                  )}
                </Detail>
                <Detail label={t.form.city}>{cityName(driver.city, locale)}</Detail>
                <Detail label={t.form.address}>{driver.address ?? notSet}</Detail>
                <Detail label={t.form.nationalId}>
                  {driver.nationalId ? <span className="ltr-nums">{driver.nationalId}</span> : notSet}
                </Detail>
                <Detail label={t.form.licenseNumber}>
                  {driver.license.number ? <span className="ltr-nums">{driver.license.number}</span> : notSet}
                </Detail>
                <Detail label={t.form.licenseExpiry}>
                  {driver.license.expiresAt ? (
                    <span className={cn(licenseExpired && "text-destructive")}>
                      {formatDate(locale, driver.license.expiresAt, { dateStyle: "medium", timeZone: "UTC" })}
                    </span>
                  ) : (
                    notSet
                  )}
                </Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <VehicleIcon className="size-4.5 text-muted-foreground" aria-hidden="true" />
                {t.detail.vehicle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-3">
                <Detail label={t.form.vehicleType}>{dict.vehicleTypes[driver.vehicle.type]}</Detail>
                <Detail label={t.form.vehicleBrand}>{driver.vehicle.brand ?? notSet}</Detail>
                <Detail label={t.form.vehicleModel}>{driver.vehicle.model ?? notSet}</Detail>
                <Detail label={t.form.vehicleYear}>{driver.vehicle.year ?? notSet}</Detail>
                <Detail label={t.form.vehicleColor}>{driver.vehicle.color ?? notSet}</Detail>
                <Detail label={t.form.plateNumber}>
                  {driver.vehicle.plateNumber ? (
                    <span dir="auto" className="rounded-md border px-2 py-0.5 font-semibold tracking-wide">
                      {driver.vehicle.plateNumber}
                    </span>
                  ) : (
                    notSet
                  )}
                </Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.detail.documents}</CardTitle>
              <CardDescription>{t.form.documentsHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {DOCUMENT_KINDS.map((kind) => {
                  const file = driver.documents[kind];
                  return (
                    <DocumentTile
                      key={kind}
                      driverId={driver.id}
                      kind={kind}
                      required={REQUIRED_DOCUMENTS.includes(kind)}
                      canUpload={permissions.manage}
                      file={
                        file
                          ? {
                              format: file.format,
                              uploadedAtLabel: formatDate(locale, file.uploadedAt),
                              version: String(file.uploadedAt.getTime()),
                            }
                          : null
                      }
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {driver.status !== "active" ? (
            <Card className={cn(driver.checklist.ready && "ring-status-good/40")}>
              <CardHeader>
                <CardTitle>{t.detail.checklist.title}</CardTitle>
                <CardDescription>
                  {driver.checklist.ready ? t.detail.checklist.ready : t.detail.checklist.notReady}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {checklistItems.map((item) => (
                    <li key={item.key} className="flex items-center gap-2.5 text-sm">
                      {item.ok ? (
                        <CircleCheckIcon className="size-4.5 shrink-0 text-status-good" aria-hidden="true" />
                      ) : (
                        <CircleDashedIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      )}
                      <span className={cn(!item.ok && "text-muted-foreground")}>{item.label}</span>
                      <span className="sr-only">{item.ok ? dict.common.yes : dict.common.no}</span>
                    </li>
                  ))}
                </ul>
                {driver.checklist.missingDocuments.length ? (
                  <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {t.documents.missing}: {driver.checklist.missingDocuments.map((kind) => t.documents[kind]).join(", ")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-xs text-muted-foreground">{t.detail.rating}</p>
                <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold">
                  {driver.rating.count > 0 ? (
                    <>
                      <StarIcon className="size-5 fill-brand text-brand" aria-hidden="true" />
                      {formatNumber(locale, driver.rating.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </>
                  ) : (
                    <span className="text-sm font-normal text-muted-foreground">{t.detail.noRating}</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.detail.completedRides}</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(locale, driver.stats.completedRides)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.detail.earnings}</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(locale, driver.stats.earnings)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.detail.lastSeen}</p>
                <p className="mt-1 text-sm font-medium">
                  {driver.lastSeenAt ? formatRelative(locale, driver.lastSeenAt, now) : t.detail.never}
                </p>
              </div>
            </CardContent>
          </Card>

          <BalanceCard
            driverId={driver.id}
            driverName={driver.name}
            balance={balance}
            payments={payments}
            canSettle={permissions.manage}
            dict={dict}
            locale={locale}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t.detail.position}</CardTitle>
            </CardHeader>
            <CardContent>
              {driver.location ? (
                <MapView
                  className="h-56"
                  label={t.detail.position}
                  zoom={14}
                  markers={[
                    {
                      id: driver.id,
                      kind: driver.availability === "on_trip" ? "driver-busy" : "driver",
                      title: driver.name,
                      meta: driver.lastSeenAt ? formatRelative(locale, driver.lastSeenAt, now) : undefined,
                      ...driver.location,
                    },
                  ]}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t.detail.noPosition}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.detail.activity}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {permissions.review ? <NoteForm driverId={driver.id} /> : null}
              <ActivityFeed items={activity} dict={dict} locale={locale} emptyText={t.detail.noActivity} now={now} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
