"use client";

import { MapIcon } from "lucide-react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { MapCanvasProps } from "./map-canvas";

export type { MapMarker, MapMarkerKind } from "./map-canvas";

function MapSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("relative w-full overflow-hidden rounded-xl", className)}>
      <span className="absolute inset-0 grid place-items-center text-muted-foreground/60">
        <MapIcon className="size-6" aria-hidden="true" />
      </span>
    </Skeleton>
  );
}

// Declared at module level: recreating it per render would tear the map down
// and rebuild it on every parent update.
const Canvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <MapSkeleton className="h-full min-h-56" />,
});

/**
 * Leaflet reaches for `window` as it loads, so the map is imported in the
 * browser only. Until it arrives, a skeleton holds the space the map will take,
 * so nothing on the page jumps.
 */
export function MapView(props: MapCanvasProps) {
  return <Canvas {...props} />;
}
