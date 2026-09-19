import "server-only";

import { redirect } from "next/navigation";

import { getLocale } from "@/lib/i18n/get-dictionary";

import { getCurrentAdmin, type CurrentAdmin } from "./dal";

/**
 * For pages and layouts (Server Components only): returns the signed-in admin
 * or redirects to the login page of the current language.
 * Permission checks are done by each page with `can()` so it can render an
 * explanatory "access restricted" state instead of a bare redirect.
 */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(`/${await getLocale()}/admin/login`);
  return admin;
}
