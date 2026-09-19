"use server";

import { redirect } from "next/navigation";

import { createSession, deleteSession } from "@/lib/auth/session";
import { hasLocale, type Locale } from "@/lib/i18n/config";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { authenticateAdmin } from "@/lib/services/admins";
import { loginSchema } from "@/lib/validation/admin";
import { formValues, toFieldErrors, type ActionState } from "@/lib/validation/common";

import { localeFrom, unexpected } from "./shared";

/** Only allow redirects back into the backoffice of the same language. */
function safeNext(value: FormDataEntryValue | null, locale: Locale) {
  const home = `/${locale}/admin`;
  if (typeof value !== "string") return home;
  if (!value.startsWith(`${home}/`) && value !== home) return home;
  if (value.startsWith("//") || value.includes("\\") || value.startsWith(`/${locale}/admin/login`)) return home;
  return value;
}

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);

  const ip = await getClientIp();
  if (!rateLimit(`login:${ip}`, 10, 10 * 60_000).ok) return { status: "error", error: "rateLimited" };

  const parsed = loginSchema.safeParse(formValues(formData, ["email", "password"]));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const result = await authenticateAdmin(parsed.data.email, parsed.data.password);
    if (!result.ok) return { status: "error", error: result.error };
    await createSession({ sub: result.data.id, role: result.data.role, ver: result.data.sessionVersion });
  } catch (error) {
    return unexpected(error);
  }

  redirect(safeNext(formData.get("next"), locale));
}

export async function logoutAction(locale: string) {
  await deleteSession();
  redirect(`/${hasLocale(locale) ? locale : "fr"}/admin/login`);
}
