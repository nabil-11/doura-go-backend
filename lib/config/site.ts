import { haversineKm, pointInPolygon, type LatLng } from "@/lib/domain/geo";
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
  /** City centre, used to label a pickup point and to centre a map. */
  center: LatLng;
  /**
   * How far from the centre rides are accepted, in kilometres. Only used where
   * no zone polygon covers the city — a drawn boundary always wins.
   */
  radiusKm: number;
  /**
   * The conurbation this city belongs to. Cities in one zone share a service
   * area and a driver pool: a rider in La Marsa and a driver registered in
   * Tunis are four kilometres apart, and the municipal line between them is
   * not a reason to refuse the ride.
   */
  zone?: string;
};

/**
 * A drawn service area, clockwise. Greater Tunis is a shape — the coast on one
 * side, farmland on the other — so it is traced rather than approximated by
 * circles, which either refuse La Marsa or accept the middle of the Gulf.
 *
 * Coordinates are deliberately a little generous at the edges: a pin dropped
 * just past the last houses should still book.
 */
type Zone = { id: string; polygon: readonly LatLng[] };

export const zones: readonly Zone[] = [
  {
    id: "grand-tunis",
    polygon: [
      { lat: 36.99, lng: 10.03 }, // Sidi Thabet, north-west
      { lat: 37.0, lng: 10.24 }, // north of Raoued, on the coast
      { lat: 36.94, lng: 10.33 }, // Gammarth
      { lat: 36.88, lng: 10.38 }, // off Sidi Bou Saïd
      { lat: 36.82, lng: 10.35 }, // La Goulette
      { lat: 36.78, lng: 10.34 }, // Radès
      { lat: 36.72, lng: 10.45 }, // Borj Cédria
      { lat: 36.65, lng: 10.42 }, // Mornag, south-east
      { lat: 36.6, lng: 10.22 }, // Mohamedia and Fouchana
      { lat: 36.63, lng: 10.05 }, // south-west
      { lat: 36.72, lng: 9.97 }, // Oued Ellil
      { lat: 36.88, lng: 9.96 }, // west of Manouba
    ],
  },
];

/**
 * Service cities. The id is what gets stored on drivers and rides, so never
 * rename an id — add a new one instead. Move this list to the database when
 * zones need to be managed from the backoffice.
 */
export const cities: readonly City[] = [
  { id: "tunis", name: { fr: "Tunis", ar: "تونس", en: "Tunis" }, launch: "launching", center: { lat: 36.8065, lng: 10.1815 }, radiusKm: 15, zone: "grand-tunis" },
  { id: "ariana", name: { fr: "Ariana", ar: "أريانة", en: "Ariana" }, launch: "launching", center: { lat: 36.8625, lng: 10.1934 }, radiusKm: 12, zone: "grand-tunis" },
  { id: "ben-arous", name: { fr: "Ben Arous", ar: "بن عروس", en: "Ben Arous" }, launch: "launching", center: { lat: 36.7533, lng: 10.2278 }, radiusKm: 12, zone: "grand-tunis" },
  { id: "manouba", name: { fr: "La Manouba", ar: "منوبة", en: "Manouba" }, launch: "launching", center: { lat: 36.8078, lng: 10.0972 }, radiusKm: 12, zone: "grand-tunis" },
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
 * Every city that shares a zone with this one — the pool a ride may be offered
 * to. A city outside any zone stands alone.
 */
export function zoneCityIds(cityId: string | null | undefined): string[] {
  const zone = getCity(cityId)?.zone;
  if (!zone) return cityId ? [cityId] : [];
  return cities.filter((city) => city.zone === zone).map((city) => city.id);
}

/** The nearest city centre among a set — what a point inside a zone is called. */
function nearestCity(point: LatLng, among: readonly City[]) {
  let best: { city: City; distanceKm: number } | null = null;
  for (const city of among) {
    const distanceKm = haversineKm(point, city.center);
    if (!best || distanceKm < best.distanceKm) best = { city, distanceKm };
  }
  return best?.city ?? null;
}

/**
 * The service area a point falls in. Returns null outside every area, which is
 * how a ride request is refused.
 *
 * A drawn zone is checked first and decides on its own: inside Greater Tunis
 * the answer is yes, and the city it reports is just the nearest centre, used
 * for labelling. Cities with no zone drawn yet fall back to their circle.
 */
export function cityForPoint(point: LatLng, { bookableOnly = true } = {}) {
  for (const zone of zones) {
    const members = cities.filter(
      (city) => city.zone === zone.id && (!bookableOnly || city.launch === "launching"),
    );
    if (!members.length) continue;
    if (pointInPolygon(point, zone.polygon)) return nearestCity(point, members);
  }

  let best: { city: City; distanceKm: number } | null = null;
  for (const city of cities) {
    if (city.zone) continue; // Already decided, and decided by its boundary.
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
