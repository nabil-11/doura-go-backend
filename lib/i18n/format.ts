// Locale-aware formatting shared by server and client code.
// All dates are displayed in the business time zone so that server-rendered
// and client-rendered values always agree.

import { localeMeta, type Locale } from "./config";

export const APP_TIME_ZONE = "Africa/Tunis";
export const DEFAULT_CURRENCY = "TND";

type Values = Record<string, string | number>;

/** Replace `{name}` placeholders in a translated string. */
export function interpolate(template: string, values: Values = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions = {}) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(localeMeta[locale].intl, options);
    numberFormats.set(key, format);
  }
  return format;
}

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(localeMeta[locale].intl, {
      timeZone: APP_TIME_ZONE,
      // CLDR defaults Tunisian locales to a 12-hour clock; 24-hour is the norm there.
      hourCycle: "h23",
      ...options,
    });
    dateFormats.set(key, format);
  }
  return format;
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions) {
  return numberFormat(locale, options).format(value);
}

export function formatCompact(locale: Locale, value: number) {
  return numberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatCurrency(
  locale: Locale,
  value: number,
  currency: string = DEFAULT_CURRENCY,
  options: Intl.NumberFormatOptions = {},
) {
  return numberFormat(locale, { style: "currency", currency, ...options }).format(value);
}

export function formatPercent(locale: Locale, ratio: number, fractionDigits = 0) {
  return numberFormat(locale, {
    style: "percent",
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  locale: Locale,
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  const date = toDate(value);
  return date ? dateFormat(locale, options).format(date) : "";
}

export function formatDateTime(locale: Locale, value: DateInput) {
  return formatDate(locale, value, { dateStyle: "medium", timeStyle: "short" });
}

export function formatTime(locale: Locale, value: DateInput) {
  return formatDate(locale, value, { timeStyle: "short" });
}

/** "3 hours ago", "il y a 3 heures", "قبل 3 ساعات" */
export function formatRelative(locale: Locale, value: DateInput, now: number = Date.now()) {
  const date = toDate(value);
  if (!date) return "";
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(localeMeta[locale].intl, { numeric: "auto" });
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return formatDate(locale, date);
}

/** "+21622123456" → "+216 22 123 456". Other formats are returned as-is. */
export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const tunisian = /^\+216(\d{2})(\d{3})(\d{3})$/.exec(phone);
  if (tunisian) return `+216 ${tunisian[1]} ${tunisian[2]} ${tunisian[3]}`;
  return phone;
}

/** Calendar day key (YYYY-MM-DD) in the business time zone. */
export function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
