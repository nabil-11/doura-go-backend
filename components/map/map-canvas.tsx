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
  /** Drawn as a dashed line between the points, in order. */
  route?: { lat: number; lng: number }[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Scroll-wheel zoom is off inside scrolling pages and on for a full map. */
  scrollZoom?: boolean;
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
  className,
  label,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

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

    return () => {
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
      group.addLayer(
        L.polyline(
          route.map((point) => [point.lat, point.lng] as [number, number]),
          { color: "#0f1115", weight: 3, opacity: 0.55, dashArray: "6 8" },
        ),
      );
    }

    // Frame whatever there is: several points get a fitted view, one gets
    // centred, none leaves the map where it was.
    const points = markers.map((marker) => [marker.lat, marker.lng] as [number, number]);
    if (points.length > 1) {
      instance.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    } else if (points.length === 1) {
      instance.setView(points[0], Math.max(instance.getZoom(), zoom));
    } else if (center) {
      instance.setView([center.lat, center.lng], zoom);
    }
  }, [markers, route, center, zoom]);

  // Leaflet measures its container on creation; a map that starts hidden (a
  // tab, a collapsed card) needs telling once it has a size.
  useEffect(() => {
    if (!container.current || !map.current) return;
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      className={cn("dg-map z-0 w-full overflow-hidden rounded-xl border", className)}
    />
  );
}
