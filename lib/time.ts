// Calendar maths in the business time zone (Africa/Tunis), independent of
// the server's own time zone.

import { APP_TIME_ZONE, dayKey } from "@/lib/i18n/format";

/**
 * Current time for Server Components. They render once per request, so
 * reading the clock there is safe; this keeps it out of component bodies.
 */
export function requestTime() {
  return Date.now();
}

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Offset of the business time zone from UTC, in minutes, at a given instant. */
function offsetMinutes(date: Date) {
  const parts = partsFormat.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** UTC instant of midnight (business time zone) for a YYYY-MM-DD key. */
export function zonedMidnight(key: string) {
  const guess = new Date(`${key}T00:00:00.000Z`);
  return new Date(guess.getTime() - offsetMinutes(guess) * 60_000);
}

export function startOfDay(date: Date = new Date()) {
  return zonedMidnight(dayKey(date));
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

export function startOfMonth(date: Date = new Date()) {
  return zonedMidnight(`${dayKey(date).slice(0, 7)}-01`);
}

/** The last `count` day keys, oldest first, ending today. */
export function lastDayKeys(count: number, now: Date = new Date()) {
  const today = startOfDay(now);
  return Array.from({ length: count }, (_, index) => dayKey(addDays(today, index - (count - 1))));
}
