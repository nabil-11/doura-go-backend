"use client";

import { BanknoteIcon, GaugeIcon, UserRoundIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { DriveCopy } from "./shell";

export type DriveTab = "drive" | "earnings" | "account";

const ICONS = { drive: GaugeIcon, earnings: BanknoteIcon, account: UserRoundIcon } as const;

/**
 * The three places a driver goes when they are not on a ride.
 *
 * At the bottom, where a thumb is, and out of the way of the sheet above it.
 * It disappears entirely during a ride: there is one thing to do then, and a
 * driver on a moto has no business navigating tabs.
 */
export function TabBar({
  copy,
  tab,
  onTab,
}: {
  copy: DriveCopy;
  tab: DriveTab;
  onTab: (tab: DriveTab) => void;
}) {
  const tabs: DriveTab[] = ["drive", "earnings", "account"];

  return (
    <nav
      aria-label={copy.title}
      className="z-20 grid shrink-0 grid-cols-3 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:mt-auto"
    >
      {tabs.map((key) => {
        const Icon = ICONS[key];
        const selected = key === tab;
        return (
          <button
            key={key}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onTab(key)}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
              selected ? "text-brand-deep" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-5", selected && "fill-brand/15")} aria-hidden="true" />
            {copy.tabs[key]}
          </button>
        );
      })}
    </nav>
  );
}
