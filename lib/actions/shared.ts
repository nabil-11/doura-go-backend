import "server-only";

import { revalidatePath } from "next/cache";

import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n/config";

/** Refresh every backoffice page (all languages) after a mutation. */
export function revalidateBackoffice() {
  revalidatePath("/[lang]/admin", "layout");
}

export function localeFrom(formData: FormData): Locale {
  const value = formData.get("locale");
  return typeof value === "string" && hasLocale(value) ? value : defaultLocale;
}

/** Log unexpected errors and turn database outages into a readable message. */
export function unexpected(error: unknown) {
  console.error("[action] unexpected error", error);
  const name = (error as { name?: string } | null)?.name ?? "";
  const isDatabase = /Mongo|Mongoose/.test(name);
  return { status: "error" as const, error: isDatabase ? ("database" as const) : ("generic" as const) };
}
