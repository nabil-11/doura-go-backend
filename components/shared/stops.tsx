"use client";

import { cn } from "@/lib/utils";

type Stop = { label: string; address: string };

/**
 * The two ends of a trip, in the marks the rider app uses for them: a hollow
 * ring where it begins, a filled square where it ends, and a dashed line
 * joining the two. The label above each address is where the numbers go — how
 * far the pickup is, how long the trip runs — because those are what a driver
 * reads first and the street name is what they read second.
 *
 * Static on purpose: this is a trip being reported, not chosen — the driver
 * being told where to go, or a rider being shown the ride that just ended.
 */
export function StopsList({
  pickup,
  dropoff,
  /** The rider is aboard, so the pickup is history. */
  pickupDone = false,
  className,
}: {
  pickup: Stop;
  dropoff: Stop;
  pickupDone?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Row
        marker={<span className="size-2.5 rounded-full border-[3px] border-asphalt dark:border-white" />}
        stop={pickup}
        muted={pickupDone}
      />
      {/* Joins the two markers, and lines up with them: half the marker's
          width in from the start. */}
      <span
        aria-hidden="true"
        className="ms-[5px] block h-4 border-s border-dashed border-muted-foreground/50"
      />
      <Row marker={<span className="size-2.5 rounded-[3px] bg-asphalt dark:bg-white" />} stop={dropoff} />
    </div>
  );
}

function Row({
  marker,
  stop,
  muted = false,
}: {
  marker: React.ReactNode;
  stop: Stop;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 flex size-2.5 shrink-0 items-center justify-center">{marker}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{stop.label}</span>
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            muted && "text-muted-foreground line-through",
          )}
        >
          {stop.address}
        </span>
      </span>
    </div>
  );
}
