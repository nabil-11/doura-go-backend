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
};

/**
 * Service cities. The id is what gets stored on drivers and rides, so never
 * rename an id — add a new one instead. Move this list to the database when
 * zones need to be managed from the backoffice.
 */
export const cities: readonly City[] = [
  { id: "tunis", name: { fr: "Tunis", ar: "تونس", en: "Tunis" }, launch: "launching" },
  { id: "ariana", name: { fr: "Ariana", ar: "أريانة", en: "Ariana" }, launch: "launching" },
  { id: "ben-arous", name: { fr: "Ben Arous", ar: "بن عروس", en: "Ben Arous" }, launch: "launching" },
  { id: "manouba", name: { fr: "La Manouba", ar: "منوبة", en: "Manouba" }, launch: "launching" },
  { id: "nabeul", name: { fr: "Nabeul", ar: "نابل", en: "Nabeul" }, launch: "soon" },
  { id: "sousse", name: { fr: "Sousse", ar: "سوسة", en: "Sousse" }, launch: "soon" },
  { id: "monastir", name: { fr: "Monastir", ar: "المنستير", en: "Monastir" }, launch: "soon" },
  { id: "sfax", name: { fr: "Sfax", ar: "صفاقس", en: "Sfax" }, launch: "soon" },
  { id: "bizerte", name: { fr: "Bizerte", ar: "بنزرت", en: "Bizerte" }, launch: "soon" },
  { id: "djerba", name: { fr: "Djerba", ar: "جربة", en: "Djerba" }, launch: "soon" },
];

export const cityIds = cities.map((city) => city.id) as [string, ...string[]];

export function cityName(id: string | null | undefined, locale: Locale) {
  if (!id) return "";
  return cities.find((city) => city.id === id)?.name[locale] ?? id;
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
