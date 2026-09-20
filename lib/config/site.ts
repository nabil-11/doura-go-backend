import { haversineKm, type LatLng } from "@/lib/domain/geo";
import type { Locale } from "@/lib/i18n/config";

export const siteConfig = {
  name: "Doura Go",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

type City = {
  id: string;
  name: Record<Locale, string>;
  /** Cities where the service opens first are shown as "launching". */
  launch: "launching" | "soon";
  /** City centre, used to place a pickup point inside a service area. */
  center: LatLng;
  /** How far from the centre rides are accepted, in kilometres. */
  radiusKm: number;
};

/**
 * Service cities. The id is what gets stored on drivers and rides, so never
 * rename an id — add a new one instead. Move this list to the database when
 * zones need to be managed from the backoffice.
 */
export const cities: readonly City[] = [
  { id: "tunis", name: { fr: "Tunis", ar: "تونس", en: "Tunis" }, launch: "launching", center: { lat: 36.8065, lng: 10.1815 }, radiusKm: 15 },
  { id: "ariana", name: { fr: "Ariana", ar: "أريانة", en: "Ariana" }, launch: "launching", center: { lat: 36.8625, lng: 10.1934 }, radiusKm: 12 },
  { id: "ben-arous", name: { fr: "Ben Arous", ar: "بن عروس", en: "Ben Arous" }, launch: "launching", center: { lat: 36.7533, lng: 10.2278 }, radiusKm: 12 },
  { id: "manouba", name: { fr: "La Manouba", ar: "منوبة", en: "Manouba" }, launch: "launching", center: { lat: 36.8078, lng: 10.0972 }, radiusKm: 12 },
  { id: "nabeul", name: { fr: "Nabeul", ar: "نابل", en: "Nabeul" }, launch: "soon", center: { lat: 36.4513, lng: 10.7376 }, radiusKm: 15 },
  { id: "sousse", name: { fr: "Sousse", ar: "سوسة", en: "Sousse" }, launch: "soon", center: { lat: 35.8256, lng: 10.6369 }, radiusKm: 18 },
  { id: "monastir", name: { fr: "Monastir", ar: "المنستير", en: "Monastir" }, launch: "soon", center: { lat: 35.7643, lng: 10.8262 }, radiusKm: 15 },
  { id: "sfax", name: { fr: "Sfax", ar: "صفاقس", en: "Sfax" }, launch: "soon", center: { lat: 34.7406, lng: 10.76 }, radiusKm: 18 },
  { id: "bizerte", name: { fr: "Bizerte", ar: "بنزرت", en: "Bizerte" }, launch: "soon", center: { lat: 37.2744, lng: 9.8739 }, radiusKm: 15 },
  { id: "djerba", name: { fr: "Djerba", ar: "جربة", en: "Djerba" }, launch: "soon", center: { lat: 33.8756, lng: 10.859 }, radiusKm: 20 },
];

export const cityIds = cities.map((city) => city.id) as [string, ...string[]];

export function cityName(id: string | null | undefined, locale: Locale) {
  if (!id) return "";
  return cities.find((city) => city.id === id)?.name[locale] ?? id;
}

export function getCity(id: string | null | undefined) {
  return cities.find((city) => city.id === id) ?? null;
}

/** Cities that take ride requests today. */
export function isBookable(id: string | null | undefined) {
  return getCity(id)?.launch === "launching";
}

/**
 * The service area a point falls in — the nearest centre that still covers it.
 * Returns null outside every area, which is how a ride request is refused.
 */
export function cityForPoint(point: LatLng, { bookableOnly = true } = {}) {
  let best: { city: City; distanceKm: number } | null = null;
  for (const city of cities) {
    if (bookableOnly && city.launch !== "launching") continue;
    const distanceKm = haversineKm(point, city.center);
    if (distanceKm > city.radiusKm) continue;
    if (!best || distanceKm < best.distanceKm) best = { city, distanceKm };
  }
  return best?.city ?? null;
}

/** Suggestions for the vehicle brand field (free text is still accepted). */
export const vehicleBrands = [
  "Yamaha",
  "Honda",
  "SYM",
  "Kymco",
  "Piaggio",
  "Peugeot",
  "Forza",
  "Zimota",
  "Suzuki",
  "Benelli",
  "TVS",
] as const;
