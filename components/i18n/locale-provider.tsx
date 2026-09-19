"use client";

import { createContext, use } from "react";

import { localizePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const LocaleContext = createContext<Locale | null>(null);
const DictionaryContext = createContext<Dictionary | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale() {
  const locale = use(LocaleContext);
  if (!locale) throw new Error("useLocale must be used inside <LocaleProvider>");
  return locale;
}

/** Build a path in the current language: href("/admin/drivers") → "/fr/admin/drivers" */
export function useLocalizedHref() {
  const locale = useLocale();
  return (path: string) => localizePath(locale, path);
}

/**
 * Makes the full dictionary available to client components of the backoffice.
 * The public website passes only the strings it needs as props instead.
 */
export function DictionaryProvider({ dict, children }: { dict: Dictionary; children: React.ReactNode }) {
  return <DictionaryContext value={dict}>{children}</DictionaryContext>;
}

export function useDictionary() {
  const dict = use(DictionaryContext);
  if (!dict) throw new Error("useDictionary must be used inside <DictionaryProvider>");
  return dict;
}
