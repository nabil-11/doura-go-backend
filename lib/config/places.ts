import type { LatLng } from "@/lib/domain/geo";

/**
 * Places in Greater Tunis, by the names people actually type.
 *
 * A geocoder is built to answer addresses, and riders do not think in
 * addresses — they think "Lac 2", "Menzah 6", "Bhar Lazreg". OpenStreetMap
 * holds many of those only in Arabic, or not as searchable names at all:
 * typing "lac" into Nominatim returns nothing whatsoever, which is how a real
 * neighbourhood of Tunis came to look like a place Doura Go had never heard
 * of. So the names are kept here, matched locally, and answered instantly.
 *
 * Coordinates were resolved against OpenStreetMap once and checked by hand.
 * This does not replace the geocoder: these results are offered first, and
 * whatever the provider finds follows them.
 */
export type LocalPlace = {
  name: string;
  /** The governorate, shown as the second line so two similar names separate. */
  area: string;
  lat: number;
  lng: number;
  /** Other spellings people type. The name itself is always matched too. */
  aliases?: string[];
};

export const LOCAL_PLACES: readonly LocalPlace[] = [
  { name: "Avenue Habib Bourguiba", area: "Tunis", lat: 36.7992, lng: 10.1806, aliases: ["centre ville", "habib bourguiba", "avenue"] },
  { name: "Bab Bhar", area: "Tunis", lat: 36.80082, lng: 10.19935 },
  { name: "Bab Souika", area: "Tunis", lat: 36.80595, lng: 10.16246 },
  { name: "Médina de Tunis", area: "Tunis", lat: 36.79869, lng: 10.17174, aliases: ["medina", "souk"] },
  { name: "Lafayette", area: "Tunis", lat: 36.81321, lng: 10.18154 },
  { name: "Parc du Belvédère", area: "Tunis", lat: 36.82334, lng: 10.17157, aliases: ["belvedere"] },
  { name: "Mutuelleville", area: "Tunis", lat: 36.83346, lng: 10.17086 },
  { name: "Montplaisir", area: "Tunis", lat: 36.81703, lng: 10.18637 },
  { name: "Le Bardo", area: "Tunis", lat: 36.814, lng: 10.1363, aliases: ["bardo"] },
  { name: "El Omrane", area: "Tunis", lat: 36.82126, lng: 10.15318, aliases: ["omrane"] },
  { name: "El Menzah", area: "Tunis", lat: 36.83561, lng: 10.15836, aliases: ["menzah"] },
  { name: "El Menzah 5", area: "Tunis", lat: 36.84828, lng: 10.17539, aliases: ["menzah 5"] },
  { name: "El Menzah 6", area: "Tunis", lat: 36.84449, lng: 10.18228, aliases: ["menzah 6"] },
  { name: "El Menzah 9", area: "Tunis", lat: 36.848, lng: 10.156, aliases: ["menzah 9"] },
  { name: "El Manar", area: "Tunis", lat: 36.84398, lng: 10.15394, aliases: ["manar"] },
  { name: "Ennasr", area: "Ariana", lat: 36.84219, lng: 10.11316, aliases: ["nasr", "ennasr 2", "nasr 2"] },
  { name: "Cité Olympique", area: "Tunis", lat: 36.83618, lng: 10.19453, aliases: ["olympique"] },
  { name: "Les Berges du Lac", area: "Tunis", lat: 36.8325, lng: 10.2395, aliases: ["lac", "lac 1", "berges du lac", "les berges du lac 1"] },
  { name: "Les Berges du Lac 2", area: "Tunis", lat: 36.8455, lng: 10.2725, aliases: ["lac 2", "berges du lac 2"] },
  { name: "Jardins de Carthage", area: "Tunis", lat: 36.86011, lng: 10.28989, aliases: ["jardins de carthage"] },
  { name: "Mellassine", area: "Tunis", lat: 36.79515, lng: 10.15159 },
  { name: "Ibn Khaldoun", area: "Tunis", lat: 36.83073, lng: 10.13416 },
  { name: "El Ouardia", area: "Tunis", lat: 36.77208, lng: 10.18206, aliases: ["ouardia"] },
  { name: "Jebel Jelloud", area: "Tunis", lat: 36.77238, lng: 10.2082 },
  { name: "El Kabaria", area: "Tunis", lat: 36.74229, lng: 10.19181, aliases: ["kabaria"] },
  { name: "Sidi Hassine", area: "Tunis", lat: 36.77084, lng: 10.11025 },
  { name: "Marché Central de Tunis", area: "Tunis", lat: 36.79744, lng: 10.17731, aliases: ["marche central"] },
  { name: "Gare de Tunis", area: "Tunis", lat: 36.79525, lng: 10.18058, aliases: ["gare"] },
  { name: "Hôpital Charles Nicolle", area: "Tunis", lat: 36.80285, lng: 10.16132, aliases: ["charles nicolle"] },
  { name: "Hôpital La Rabta", area: "Tunis", lat: 36.80229, lng: 10.15503, aliases: ["rabta"] },
  { name: "Cité de la Culture", area: "Tunis", lat: 36.8109, lng: 10.18608 },
  { name: "La Goulette", area: "Tunis", lat: 36.81593, lng: 10.30424, aliases: ["goulette"] },
  { name: "Le Kram", area: "Tunis", lat: 36.83483, lng: 10.31815, aliases: ["kram"] },
  { name: "Carthage", area: "Tunis", lat: 36.85481, lng: 10.33099 },
  { name: "Sidi Bou Saïd", area: "Tunis", lat: 36.87109, lng: 10.34905, aliases: ["sidi bou said"] },
  { name: "La Marsa", area: "Tunis", lat: 36.87909, lng: 10.32768, aliases: ["marsa"] },
  { name: "Marsa Plage", area: "Tunis", lat: 36.89389, lng: 10.32169, aliases: ["marsa plage"] },
  { name: "Gammarth", area: "Tunis", lat: 36.90515, lng: 10.29825 },
  { name: "Bhar Lazreg", area: "Tunis", lat: 36.88108, lng: 10.28924, aliases: ["bhar lazreg"] },
  { name: "Ariana", area: "Ariana", lat: 36.85874, lng: 10.18823, aliases: ["ariana ville"] },
  { name: "La Soukra", area: "Ariana", lat: 36.87498, lng: 10.24543, aliases: ["soukra"] },
  { name: "Raoued", area: "Ariana", lat: 36.9536, lng: 10.18919 },
  { name: "Sidi Thabet", area: "Ariana", lat: 36.90851, lng: 10.04255 },
  { name: "Borj Louzir", area: "Ariana", lat: 36.86065, lng: 10.2087 },
  { name: "Chotrana", area: "Ariana", lat: 36.89478, lng: 10.22017 },
  { name: "Mnihla", area: "Ariana", lat: 36.85335, lng: 10.11697 },
  { name: "Ettadhamen", area: "Ariana", lat: 36.83384, lng: 10.10615, aliases: ["tadhamen"] },
  { name: "Dar Fadhal", area: "Ariana", lat: 36.86533, lng: 10.24253 },
  { name: "Ben Arous", area: "Ben Arous", lat: 36.75169, lng: 10.2245 },
  { name: "Mégrine", area: "Ben Arous", lat: 36.77034, lng: 10.23159, aliases: ["megrine"] },
  { name: "Radès", area: "Ben Arous", lat: 36.76789, lng: 10.27246, aliases: ["rades"] },
  { name: "Ezzahra", area: "Ben Arous", lat: 36.74045, lng: 10.30295 },
  { name: "Hammam Lif", area: "Ben Arous", lat: 36.73138, lng: 10.3364 },
  { name: "Hammam Chott", area: "Ben Arous", lat: 36.71895, lng: 10.36427 },
  { name: "Borj Cédria", area: "Ben Arous", lat: 36.69649, lng: 10.38571, aliases: ["borj cedria"] },
  { name: "El Mourouj", area: "Ben Arous", lat: 36.71983, lng: 10.21924, aliases: ["mourouj"] },
  { name: "Fouchana", area: "Ben Arous", lat: 36.69872, lng: 10.16936 },
  { name: "Mohamedia", area: "Ben Arous", lat: 36.67969, lng: 10.15704 },
  { name: "Mornag", area: "Ben Arous", lat: 36.58721, lng: 10.24376 },
  { name: "Stade Olympique de Radès", area: "Ben Arous", lat: 36.74777, lng: 10.27314, aliases: ["stade rades"] },
  { name: "Manouba", area: "Manouba", lat: 36.81133, lng: 10.0947, aliases: ["la manouba"] },
  { name: "Den Den", area: "Manouba", lat: 36.80532, lng: 10.11225 },
  { name: "Douar Hicher", area: "Manouba", lat: 36.82374, lng: 10.09606 },
  { name: "Oued Ellil", area: "Manouba", lat: 36.82976, lng: 10.0129 },
];

/**
 * Lowercased, stripped of accents and punctuation, spaces collapsed — so that
 * "Sidi Bou Saïd", "sidi bou said" and "SIDI-BOU-SAID" are one string.
 */
export function normalisePlace(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();
}

type Scored = { place: LocalPlace; score: number };

/**
 * Local matches for what someone has typed, best first.
 *
 * A name that starts with the query beats one that merely contains it — typing
 * "mar" should reach La Marsa before Hammam Chott's Rue de la Marsa — and ties
 * are broken by distance from where the rider is standing.
 */
export function matchLocalPlaces(query: string, near: LatLng | null, limit = 4): LocalPlace[] {
  const needle = normalisePlace(query);
  if (needle.length < 2) return [];

  const hits: Scored[] = [];
  for (const place of LOCAL_PLACES) {
    const names = [place.name, ...(place.aliases ?? [])].map(normalisePlace);
    let score = 0;
    for (const name of names) {
      if (name === needle) score = Math.max(score, 3);
      else if (name.startsWith(needle)) score = Math.max(score, 2);
      else if (name.includes(needle)) score = Math.max(score, 1);
    }
    if (score > 0) hits.push({ place, score });
  }

  hits.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (!near) return a.place.name.length - b.place.name.length;
    return squared(a.place, near) - squared(b.place, near);
  });
  return hits.slice(0, limit).map((hit) => hit.place);
}

/** Good enough to rank by: no need for a great circle over a few kilometres. */
function squared(place: LocalPlace, near: LatLng) {
  const dLat = place.lat - near.lat;
  const dLng = (place.lng - near.lng) * 0.8;
  return dLat * dLat + dLng * dLng;
}
