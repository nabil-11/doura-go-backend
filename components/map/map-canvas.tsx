"use client";

import "leaflet/dist/leaflet.css";
import "./map.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type MapMarkerKind = "pickup" | "dropoff" | "driver" | "driver-busy" | "place";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: MapMarkerKind;
  title?: string;
  meta?: string;
};

export type MapCanvasProps = {
  markers: MapMarker[];
  /** The path to draw, in order: a routed path, or two points for a chord. */
  route?: { lat: number; lng: number }[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Scroll-wheel zoom is off inside scrolling pages and on for a full map. */
  scrollZoom?: boolean;
  /**
   * Choosing a point: a pin sits fixed in the middle and the map moves under
   * it. Steadier than dragging a marker with a thumb, and it works the same
   * on a phone and a mouse.
   */
  picking?: boolean;
  /** Called with the middle of the map once it settles, while picking. */
  onPick?: (point: { lat: number; lng: number }) => void;
  /**
   * How much of the map's height is covered by a sheet, 0–1. The frame is
   * fitted into what is left, so a route is never hidden behind it.
   */
  sheetInset?: number;
  className?: string;
  label: string;
};

// Tiles: OpenStreetMap by default. Their policy is fine for a backoffice used
// by a handful of people; point NEXT_PUBLIC_MAP_TILES at your own or a paid
// provider before putting a map in front of the public.
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILES ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/></svg>`;
const FLAG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V4h13l-2 4 2 4H4"/></svg>`;
const BIKE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6m-14 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6m9.5-7h3l1 2.5H21V9h-2l-2 3h-3.2L11 9.4 8.5 12H7l3.6-4.2A2 2 0 0 1 12.1 7h1.9z"/></svg>`;

const GLYPHS: Record<MapMarkerKind, string> = {
  pickup: PIN,
  dropoff: FLAG,
  driver: BIKE,
  "driver-busy": BIKE,
  place: PIN,
};

const SIZES: Record<MapMarkerKind, number> = {
  pickup: 26,
  dropoff: 26,
  driver: 30,
  "driver-busy": 30,
  place: 22,
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}

function iconFor(kind: MapMarkerKind) {
  const size = SIZES[kind];
  return L.divIcon({
    html: `<span class="dg-marker dg-marker--${kind}" style="width:${size}px;height:${size}px">${GLYPHS[kind]}</span>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * A Leaflet map, driven by props.
 *
 * Leaflet works on a live DOM node rather than a virtual one, so the map is
 * created once and every later change is applied to it by hand: markers and the
 * route live in layer groups that are emptied and refilled. Rendered only in
 * the browser — see `map-view.tsx`.
 */
export default function MapCanvas({
  markers,
  route,
  center,
  zoom = 13,
  scrollZoom = false,
  picking = false,
  onPick,
  sheetInset = 0,
  className,
  label,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  // Held in a ref so a new handler on every render never tears the map down.
  // Written in an effect rather than during render, which React forbids.
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = L.map(container.current, {
      center: [center?.lat ?? 36.8065, center?.lng ?? 10.1815],
      zoom,
      scrollWheelZoom: scrollZoom,
      attributionControl: true,
      zoomControl: true,
    });

    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    map.current = instance;

    const report = () => {
      const middle = instance.getCenter();
      pick.current?.({ lat: middle.lat, lng: middle.lng });
    };
    instance.on("moveend", report);

    return () => {
      instance.off("moveend", report);
      instance.remove();
      map.current = null;
      layer.current = null;
    };
    // Created once; later prop changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group) return;

    group.clearLayers();

    for (const marker of markers) {
      const pin = L.marker([marker.lat, marker.lng], {
        icon: iconFor(marker.kind),
        title: marker.title,
        keyboard: false,
      });
      if (marker.title) {
        pin.bindPopup(
          `<span class="dg-popup-title">${escapeHtml(marker.title)}</span>` +
            (marker.meta ? `<br><span class="dg-popup-meta">${escapeHtml(marker.meta)}</span>` : ""),
        );
      }
      group.addLayer(pin);
    }

    if (route && route.length > 1) {
      const line = route.map((point) => [point.lat, point.lng] as [number, number]);
      // Two points mean nothing was routed and this is the chord between them,
      // so it stays dashed — a real path along streets is drawn solid, with a
      // dark casing under it so it reads over any colour of map.
      if (route.length === 2) {
        group.addLayer(L.polyline(line, { color: "#0f1115", weight: 3, opacity: 0.5, dashArray: "6 8" }));
      } else {
        group.addLayer(L.polyline(line, { color: "#0f1115", weight: 7, opacity: 0.35, lineCap: "round" }));
        group.addLayer(L.polyline(line, { color: "#e0ae00", weight: 4, opacity: 1, lineCap: "round" }));
      }
    }

    // While a point is being chosen the map belongs to the thumb dragging it.
    // Re-framing here would fight that, and worse: moving the map fires
    // `moveend`, which reports a new centre, which would frame it again.
    if (picking) return;

    // Frame whatever there is: several points get a fitted view, one gets
    // centred, none leaves the map where it was. The route counts — a path that
    // loops around a one-way system reaches past both of its pins.
    const points = [
      ...markers.map((marker) => [marker.lat, marker.lng] as [number, number]),
      ...(route ?? []).map((point) => [point.lat, point.lng] as [number, number]),
    ];
    if (points.length > 1) {
      // Whatever a sheet covers is not usable space, so the frame is pushed up
      // out of it rather than drawing the route underneath.
      const hidden = Math.round(instance.getSize().y * Math.min(0.8, Math.max(0, sheetInset)));
      instance.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [48, 48],
        paddingBottomRight: [48, 48 + hidden],
        maxZoom: 15,
      });
    } else if (points.length === 1) {
      instance.setView(points[0], Math.max(instance.getZoom(), zoom));
    } else if (center) {
      instance.setView([center.lat, center.lng], zoom);
    }
  }, [markers, route, center, zoom, picking, sheetInset]);

  // Leaflet measures its container on creation; a map that starts hidden (a
  // tab, a collapsed card) needs telling once it has a size.
  useEffect(() => {
    if (!container.current || !map.current) return;
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("dg-map relative isolate z-0 w-full overflow-hidden rounded-xl border", className)}>
      <div ref={container} role="img" aria-label={label} className="size-full" />
      {/* The pin the map moves under. Leaflet's own panes run to z-index 700,
          so this has to sit above them — and `isolate` on the wrapper keeps
          that number from reaching anything outside the map. */}
      {picking ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute start-1/2 top-1/2 z-[800] -ms-3.5 -mt-7 size-7 rounded-full rounded-bl-none border-[3px] border-white bg-brand shadow-lg [rotate:-45deg] after:absolute after:inset-1.5 after:rounded-full after:bg-asphalt after:content-['']"
        />
      ) : null}
    </div>
  );
}
