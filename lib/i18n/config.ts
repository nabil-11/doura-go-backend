// Locale configuration shared by the proxy, server components and client components.
// Keep this file free of server-only imports.

export const locales = ["fr", "ar", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Cookie remembering the visitor's last used language (read by the proxy). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

type LocaleMeta = {
  /** Native name, shown in the language switcher */
  label: string;
  /** Compact label for tight spaces */
  short: string;
  dir: "ltr" | "rtl";
  /** BCP 47 tag used for Intl formatting (dates, numbers, currency) */
  intl: string;
  /** Open Graph locale */
  og: string;
};

export const localeMeta: Record<Locale, LocaleMeta> = {
  fr: { label: "Français", short: "FR", dir: "ltr", intl: "fr-TN", og: "fr_TN" },
  ar: { label: "العربية", short: "ع", dir: "rtl", intl: "ar-TN", og: "ar_TN" },
  en: { label: "English", short: "EN", dir: "ltr", intl: "en-GB", og: "en_GB" },
};

export function hasLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function getDirection(locale: Locale) {
  return localeMeta[locale].dir;
}

/** Prefix an app path (starting with "/") with the locale segment. */
export function localizePath(locale: Locale, path = "/") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Replace the locale segment of a pathname, keeping the rest of the path. */
export function switchLocalePath(pathname: string, locale: Locale) {
  const segments = pathname.split("/");
  if (hasLocale(segments[1])) {
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  }
  return localizePath(locale, pathname);
}

/**
 * Pick the best supported locale from an Accept-Language header.
 * Falls back to the default locale.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (hasLocale(base)) return base;
  }
  return defaultLocale;
}
