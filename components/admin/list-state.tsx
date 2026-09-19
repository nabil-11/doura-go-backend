"use client";

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState, useTransition } from "react";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

/**
 * List pages keep their filters in the URL (shareable, back-button friendly).
 * Every filter change runs in one transition, so the table can stay on screen
 * — dimmed — while the next result streams in, instead of flashing a skeleton.
 */
type ListState = {
  isPending: boolean;
  pendingKey: string | null;
  setParams: (updates: Record<string, string | null>, options?: { resetPage?: boolean; key?: string }) => void;
};

const ListStateContext = createContext<ListState | null>(null);

export function ListStateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const setParams = useCallback<ListState["setParams"]>(
    (updates, { resetPage = true, key } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [name, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(name);
        else params.set(name, value);
      }
      if (resetPage && !("page" in updates)) params.delete("page");
      const query = params.toString();
      setPendingKey(key ?? null);
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <ListStateContext value={{ isPending, pendingKey: isPending ? pendingKey : null, setParams }}>
      {children}
    </ListStateContext>
  );
}

export function useListState() {
  const state = use(ListStateContext);
  if (!state) throw new Error("useListState must be used inside <ListStateProvider>");
  return state;
}

/** Holds the previous results at reduced opacity while new ones load. */
export function ListBody({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isPending } = useListState();
  return (
    <div
      aria-busy={isPending}
      data-pending={isPending ? "" : undefined}
      className={cn("transition-opacity duration-200 data-pending:pointer-events-none data-pending:opacity-55", className)}
    >
      {children}
    </div>
  );
}

export function SearchFilter({ placeholder, param = "q" }: { placeholder: string; param?: string }) {
  const searchParams = useSearchParams();
  const { setParams, pendingKey } = useListState();
  const dict = useDictionary();
  const urlValue = searchParams.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the URL when it changes from elsewhere (tabs, back button, clear).
  const [lastUrlValue, setLastUrlValue] = useState(urlValue);
  if (urlValue !== lastUrlValue) {
    setLastUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function update(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams({ [param]: next.trim() || null }, { key: "search" }), 350);
  }

  return (
    <InputGroup className="h-9 w-full sm:max-w-xs">
      <InputGroupAddon>
        {pendingKey === "search" ? <Spinner aria-label={dict.common.loading} /> : <SearchIcon aria-hidden="true" />}
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={value}
        onChange={(event) => update(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label={dict.common.close} onClick={() => update("")}>
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

export type FilterTab = { value: string; label: string; count?: number };

/** Segmented status filter. "all" removes the parameter. */
export function FilterTabs({ items, param = "status", label }: { items: FilterTab[]; param?: string; label: string }) {
  const searchParams = useSearchParams();
  const { setParams, pendingKey } = useListState();
  const locale = useLocale();
  const current = searchParams.get(param) ?? "all";

  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
      {items.map((item) => {
        const active = item.value === current;
        const loading = pendingKey === `tab:${item.value}`;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() =>
              setParams({ [param]: item.value === "all" ? null : item.value }, { key: `tab:${item.value}` })
            }
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-asphalt text-white dark:bg-white dark:text-asphalt" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
            {loading ? (
              <Spinner className="size-3.5" aria-hidden="true" />
            ) : item.count !== undefined ? (
              <span
                className={cn(
                  "tabular min-w-5 rounded-full px-1.5 text-center text-xs",
                  active ? "bg-white/15 dark:bg-asphalt/10" : "bg-muted",
                )}
              >
                {formatNumber(locale, item.count)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SelectFilter({
  param,
  placeholder,
  allLabel,
  options,
}: {
  param: string;
  placeholder: string;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  const searchParams = useSearchParams();
  const { setParams } = useListState();
  const current = searchParams.get(param) ?? "all";

  return (
    <Select value={current} onValueChange={(value) => setParams({ [param]: value === "all" ? null : value }, { key: param })}>
      <SelectTrigger className="h-9 w-full sm:w-44" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PaginationBar({
  page,
  pageCount,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const { setParams, pendingKey } = useListState();
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const go = (next: number) => setParams({ page: next > 1 ? String(next) : null }, { resetPage: false, key: `page:${next}` });

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row">
      <p className="tabular text-muted-foreground">
        {interpolate(dict.common.showing, {
          from: formatNumber(locale, from),
          to: formatNumber(locale, to),
          total: formatNumber(locale, total),
        })}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          {pendingKey === `page:${page - 1}` ? <Spinner /> : <ChevronLeftIcon className="rtl:rotate-180" />}
          {dict.common.previous}
        </Button>
        <span className="tabular px-1 text-muted-foreground">
          {interpolate(dict.common.pageOf, { page: formatNumber(locale, page), total: formatNumber(locale, pageCount) })}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => go(page + 1)}>
          {dict.common.next}
          {pendingKey === `page:${page + 1}` ? <Spinner /> : <ChevronRightIcon className="rtl:rotate-180" />}
        </Button>
      </div>
    </div>
  );
}
