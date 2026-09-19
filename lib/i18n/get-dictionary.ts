import { lang } from "next/root-params";
import { notFound } from "next/navigation";

import { hasLocale, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/en";

export type { Dictionary };

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import("./dictionaries/fr").then((module) => module.default),
  ar: () => import("./dictionaries/ar").then((module) => module.default),
  en: () => import("./dictionaries/en").then((module) => module.default),
};

/** Current locale from the `[lang]` root segment (Server Components only). */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

/**
 * Load the dictionary for a locale. Without an argument it uses the current
 * route's locale (Server Components only — pass the locale explicitly in
 * Route Handlers and Server Actions).
 */
export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  const resolved = locale ?? (await getLocale());
  return loaders[resolved]();
}
