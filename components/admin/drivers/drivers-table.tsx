import { MotorbikeIcon, ScooterIcon, StarIcon } from "lucide-react";
import Link from "next/link";

import { AvailabilityIndicator, DriverStatusBadge } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cityName } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatDate, formatNumber, formatPhone, initials } from "@/lib/i18n/format";
import type { DriverListItem } from "@/lib/services/drivers";

import { DriverRowActions } from "./driver-row-actions";

export function DriversTable({
  drivers,
  dict,
  locale,
  permissions,
}: {
  drivers: DriverListItem[];
  dict: Dictionary;
  locale: Locale;
  permissions: { manage: boolean; review: boolean; remove: boolean };
}) {
  const t = dict.admin.drivers.table;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="ps-4">{t.driver}</TableHead>
          <TableHead className="hidden md:table-cell">{t.vehicle}</TableHead>
          <TableHead className="hidden lg:table-cell">{t.city}</TableHead>
          <TableHead>{t.status}</TableHead>
          <TableHead className="hidden xl:table-cell">{t.availability}</TableHead>
          <TableHead className="hidden sm:table-cell">{t.rating}</TableHead>
          <TableHead className="hidden lg:table-cell">{t.joined}</TableHead>
          <TableHead className="w-12 pe-4">
            <span className="sr-only">{dict.common.actions}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {drivers.map((driver) => {
          const VehicleIcon = driver.vehicle.type === "scooter" ? ScooterIcon : MotorbikeIcon;
          return (
            <TableRow key={driver.id}>
              <TableCell className="ps-4">
                <Link
                  href={`/${locale}/admin/drivers/${driver.id}`}
                  className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Avatar className="size-9">
                    {driver.photoUrl ? <AvatarImage src={driver.photoUrl} alt="" /> : null}
                    <AvatarFallback className="bg-brand/20 text-xs font-semibold text-foreground">
                      {initials(driver.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">{driver.name}</span>
                    <span className="ltr-nums block text-xs text-muted-foreground">{formatPhone(driver.phone)}</span>
                  </span>
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="flex items-center gap-2">
                  <VehicleIcon className="size-4 shrink-0 text-muted-foreground" aria-label={dict.vehicleTypes[driver.vehicle.type]} />
                  <span className="min-w-0">
                    <span className="block truncate">
                      {[driver.vehicle.brand, driver.vehicle.model].filter(Boolean).join(" ") || dict.common.notSet}
                    </span>
                    {driver.vehicle.plateNumber ? (
                      <span dir="auto" className="block text-xs font-medium tracking-wide text-muted-foreground">
                        {driver.vehicle.plateNumber}
                      </span>
                    ) : null}
                  </span>
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">{cityName(driver.city, locale)}</TableCell>
              <TableCell>
                <DriverStatusBadge status={driver.status} label={dict.admin.statuses.driver[driver.status]} />
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                {driver.status === "active" ? (
                  <AvailabilityIndicator
                    availability={driver.availability}
                    label={dict.admin.drivers.availability[driver.availability]}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {driver.rating.count > 0 ? (
                  <span className="tabular inline-flex items-center gap-1">
                    <StarIcon className="size-3.5 fill-brand text-brand" aria-hidden="true" />
                    {formatNumber(locale, driver.rating.average, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
                    <span className="text-xs text-muted-foreground">({formatNumber(locale, driver.rating.count)})</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {formatDate(locale, driver.createdAt)}
              </TableCell>
              <TableCell className="pe-4 text-end">
                <DriverRowActions
                  driver={{ id: driver.id, name: driver.name, status: driver.status }}
                  permissions={permissions}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
