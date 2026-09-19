// Helpers for list pages: pagination and safe search.

export const PAGE_SIZE = 12;

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function parsePage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

export function parseSearch(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim().slice(0, 80) || undefined;
}

export function pickParam<T extends string>(value: string | string[] | undefined, allowed: readonly T[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split a search query into regex terms (max 4) that must all match. */
export function searchTerms(query: string | undefined) {
  if (!query) return [];
  return query
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((term) => ({ text: new RegExp(escapeRegex(term), "i"), digits: term.replace(/\D/g, "") }));
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
