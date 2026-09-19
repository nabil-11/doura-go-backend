import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/admin/access-denied";
import { DriverForm } from "@/components/admin/drivers/driver-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { getDriver } from "@/lib/services/drivers";

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/drivers/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const [dict, driver] = await Promise.all([getDictionary(), getDriver(id)]);
  return { title: interpolate(dict.admin.drivers.form.editTitle, { name: driver?.name ?? "" }) };
}

/** Date-only values are stored at UTC midnight; <input type="date"> wants YYYY-MM-DD. */
const toDateInput = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");

export default async function EditDriverPage({ params }: PageProps<"/[lang]/admin/drivers/[id]/edit">) {
  const { id } = await params;
  const [admin, dict, locale] = await Promise.all([requireAdmin(), getDictionary(), getLocale()]);
  if (!can(admin.role, "drivers:manage")) return <AccessDenied dict={dict} />;

  const driver = await getDriver(id);
  if (!driver) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={interpolate(dict.admin.drivers.form.editTitle, { name: driver.name })}
        description={dict.admin.drivers.form.editSubtitle}
        back={{ href: `/${locale}/admin/drivers/${driver.id}`, label: driver.name }}
      />
      <DriverForm
        mode="edit"
        driverId={driver.id}
        defaults={{
          firstName: driver.firstName,
          lastName: driver.lastName,
          phone: driver.phone,
          email: driver.email ?? "",
          dateOfBirth: toDateInput(driver.dateOfBirth),
          city: driver.city,
          address: driver.address ?? "",
          nationalId: driver.nationalId ?? "",
          licenseNumber: driver.license.number ?? "",
          licenseExpiry: toDateInput(driver.license.expiresAt),
          vehicleType: driver.vehicle.type,
          vehicleBrand: driver.vehicle.brand ?? "",
          vehicleModel: driver.vehicle.model ?? "",
          vehicleYear: driver.vehicle.year ? String(driver.vehicle.year) : "",
          vehicleColor: driver.vehicle.color ?? "",
          plateNumber: driver.vehicle.plateNumber ?? "",
        }}
      />
    </div>
  );
}
