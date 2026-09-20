/**
 * Demo data so the backoffice has something to show before the mobile apps
 * exist: drivers in every status, riders and ~30 days of rides around Tunis.
 * Everything created here is tagged `isDemo: true`.
 *
 *   npm run db:seed            add demo data (replaces previous demo data)
 *   npm run db:seed -- --reset remove demo data only
 */
import { parseArgs } from "node:util";

import { Types } from "mongoose";

import { cities } from "@/lib/config/site";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connect";
import { Activity } from "@/lib/db/models/activity";
import { Driver } from "@/lib/db/models/driver";
import { Pricing } from "@/lib/db/models/pricing";
import { Ride } from "@/lib/db/models/ride";
import { Rider } from "@/lib/db/models/rider";
import type { DriverStatus } from "@/lib/domain/driver";
import { DEFAULT_PRICING, estimateFare, type PricingValues } from "@/lib/domain/pricing";
import { startOfDay } from "@/lib/time";

function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Variables may come from the shell instead.
  }
}

// Deterministic randomness: the same seed always produces the same data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20260919);
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + random() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

const FIRST_NAMES = [
  "Sami", "Amine", "Youssef", "Mehdi", "Hamza", "Oussama", "Karim", "Walid", "Nizar", "Bilel",
  "Skander", "Aymen", "Houssem", "Firas", "Rami", "Anis", "Wassim", "Marwen", "Seif", "Hatem",
  "Ines", "Mariem", "Sarra", "Nour", "Yasmine", "Rim", "Amal", "Salma", "Emna", "Olfa",
];
const LAST_NAMES = [
  "Ben Salah", "Trabelsi", "Jebali", "Gharbi", "Hammami", "Mejri", "Bouazizi", "Chaabane", "Ayari", "Dridi",
  "Ferchichi", "Khelifi", "Mansouri", "Sassi", "Zouari", "Belhadj", "Karray", "Masmoudi", "Ghanmi", "Riahi",
];
const VEHICLES = [
  { brand: "Yamaha", model: "NMAX 125", type: "scooter" },
  { brand: "Honda", model: "PCX 125", type: "scooter" },
  { brand: "SYM", model: "Jet 14", type: "scooter" },
  { brand: "Kymco", model: "Agility 125", type: "scooter" },
  { brand: "Piaggio", model: "Liberty 125", type: "scooter" },
  { brand: "Forza", model: "FZ 150", type: "motorcycle" },
  { brand: "Honda", model: "CB 125F", type: "motorcycle" },
  { brand: "Yamaha", model: "YBR 125", type: "motorcycle" },
  { brand: "Suzuki", model: "GN 125", type: "motorcycle" },
] as const;
const COLORS = ["Noir", "Blanc", "Gris", "Rouge", "Bleu"];

/** Places around Greater Tunis: [label, latitude, longitude]. */
const PLACES: [string, number, number][] = [
  ["Avenue Habib Bourguiba", 36.8003, 10.1865],
  ["Les Berges du Lac 2", 36.8449, 10.2732],
  ["La Marsa Plage", 36.8779, 10.3247],
  ["Carthage Byrsa", 36.8528, 10.3233],
  ["Sidi Bou Saïd", 36.8687, 10.3417],
  ["El Menzah 6", 36.8445, 10.1797],
  ["Ennasr 2", 36.8623, 10.1647],
  ["Ariana Centre", 36.8625, 10.1956],
  ["Le Bardo", 36.8093, 10.1402],
  ["El Manar 2", 36.8404, 10.1552],
  ["Lafayette", 36.8133, 10.1807],
  ["Montplaisir", 36.8198, 10.1941],
  ["Centre Urbain Nord", 36.8466, 10.1972],
  ["Charguia 1", 36.8385, 10.2067],
  ["El Aouina", 36.8531, 10.2336],
  ["Mutuelleville", 36.8228, 10.1674],
  ["Ben Arous Centre", 36.7535, 10.2279],
  ["Ezzahra", 36.7436, 10.3083],
  ["Tunis Marine", 36.8005, 10.1986],
  ["Bab Saadoun", 36.8093, 10.1588],
];

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const usedPhones = new Set<string>();
function phone() {
  let value: string;
  do {
    value = `+216${pick(["2", "5", "9"])}${String(int(1000000, 9999999))}`;
  } while (usedPhones.has(value));
  usedPhones.add(value);
  return value;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const usedCodes = new Set<string>();
function rideCode() {
  let value: string;
  do {
    value = `DG-${Array.from({ length: 6 }, () => pick(CODE_CHARS.split(""))).join("")}`;
  } while (usedCodes.has(value));
  usedCodes.add(value);
  return value;
}

async function removeDemoData() {
  const [drivers, riders] = await Promise.all([
    Driver.find({ isDemo: true }).select("_id").lean(),
    Rider.find({ isDemo: true }).select("_id").lean(),
  ]);
  const ids = [...drivers, ...riders].map((doc) => doc._id);
  const [activity, rides, driverResult, riderResult] = await Promise.all([
    Activity.deleteMany({ "subject.id": { $in: ids } }),
    Ride.deleteMany({ isDemo: true }),
    Driver.deleteMany({ isDemo: true }),
    Rider.deleteMany({ isDemo: true }),
  ]);
  console.log(
    `Removed demo data: ${driverResult.deletedCount} drivers, ${riderResult.deletedCount} riders, ${rides.deletedCount} rides, ${activity.deletedCount} activity entries.`,
  );
}

async function seed() {
  const pricingDoc = await Pricing.findOne({ key: "default" }).lean();
  const pricing: PricingValues = pricingDoc ?? DEFAULT_PRICING;
  const now = Date.now();
  const day = 86_400_000;
  const launchCities = cities.filter((city) => city.launch === "launching").map((city) => city.id);

  // Drivers ------------------------------------------------------------------
  const statusPlan: DriverStatus[] = [
    ...Array<DriverStatus>(15).fill("active"),
    ...Array<DriverStatus>(5).fill("pending"),
    ...Array<DriverStatus>(2).fill("suspended"),
    ...Array<DriverStatus>(2).fill("rejected"),
  ];

  const drivers = statusPlan.map((status, index) => {
    const vehicle = pick(VEHICLES);
    const createdAt = new Date(now - int(status === "pending" ? 0 : 20, status === "pending" ? 6 : 120) * day - int(0, 20) * 3_600_000);
    const complete = status !== "pending" || index % 2 === 0;
    const place = pick(PLACES);
    return {
      _id: new Types.ObjectId(),
      firstName: FIRST_NAMES[index % FIRST_NAMES.length],
      lastName: pick(LAST_NAMES),
      phone: phone(),
      email: null,
      dateOfBirth: new Date(Date.UTC(int(1978, 2003), int(0, 11), int(1, 28))),
      city: index < 18 ? pick(launchCities) : pick(cities.map((city) => city.id)),
      status,
      source: status === "pending" ? "website" : pick(["website", "admin"] as const),
      availability: status === "active" ? pick(["online", "online", "offline", "on_trip"] as const) : "offline",
      license: {
        number: complete ? `${int(10, 99)}/${int(100000, 999999)}` : null,
        expiresAt: complete ? new Date(Date.UTC(int(2027, 2033), int(0, 11), 1)) : null,
      },
      vehicle: {
        type: vehicle.type,
        brand: vehicle.brand,
        model: vehicle.model,
        year: int(2016, 2025),
        color: pick(COLORS),
        plateNumber: complete ? `${int(100, 260)} TU ${int(1000, 9999)}` : null,
      },
      rating: { average: 0, count: 0 },
      stats: { completedRides: 0, earnings: 0 },
      location:
        status === "active"
          ? { type: "Point" as const, coordinates: [round(place[2] + between(-0.01, 0.01), 5), round(place[1] + between(-0.01, 0.01), 5)] as [number, number] }
          : undefined,
      lastSeenAt: status === "active" ? new Date(now - int(1, 600) * 60_000) : null,
      review:
        status === "rejected"
          ? { by: null, at: new Date(createdAt.getTime() + 2 * day), reason: "Permis de conduire illisible." }
          : status === "suspended"
            ? { by: null, at: new Date(now - int(1, 5) * day), reason: "Assurance expirée — en attente du nouveau certificat." }
            : undefined,
      approvedAt: status === "active" || status === "suspended" ? new Date(createdAt.getTime() + int(1, 3) * day) : null,
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
    };
  });

  // Riders -------------------------------------------------------------------
  const riders = Array.from({ length: 40 }, (_, index) => {
    const createdAt = new Date(now - int(1, 90) * day);
    return {
      _id: new Types.ObjectId(),
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      phone: phone(),
      email: null,
      status: index === 7 ? ("blocked" as const) : ("active" as const),
      rating: { average: 0, count: 0 },
      stats: { completedRides: 0 },
      lastRideAt: null as Date | null,
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
    };
  });

  // Rides --------------------------------------------------------------------
  const activeDrivers = drivers.filter((driver) => driver.status === "active" || driver.status === "suspended");
  const activeRiders = riders.filter((rider) => rider.status === "active");
  const rides = [];

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const weekday = new Date(now - daysAgo * day).getUTCDay();
    const growth = 0.55 + (29 - daysAgo) / 45; // the service is growing
    // Today only gets the share of rides matching the hours already elapsed.
    const dayProgress = daysAgo === 0 ? Math.min(1, (now - startOfDay(new Date(now)).getTime()) / day) : 1;
    const count = Math.max(
      daysAgo === 0 ? 2 : 1,
      Math.round(((weekday === 0 ? 8 : weekday === 6 ? 11 : 14) * growth + int(-3, 3)) * dayProgress),
    );
    for (let i = 0; i < count; i++) {
      // Days and hours follow the business time zone, like the dashboard does.
      const hour = pick([7, 8, 8, 9, 12, 13, 13, 17, 17, 18, 18, 19, 20, 22]);
      const dayStart = startOfDay(new Date(now - daysAgo * day));
      let requestedAt = new Date(dayStart.getTime() + hour * 3_600_000 + int(0, 59) * 60_000 + int(0, 59) * 1000);
      if (requestedAt.getTime() > now) {
        // Spread the remainder over the part of today that has already happened.
        requestedAt = new Date(dayStart.getTime() + between(0, Math.max(now - dayStart.getTime() - 60_000, 60_000)));
      }

      const from = pick(PLACES);
      let to = pick(PLACES);
      while (to === from) to = pick(PLACES);
      const distanceKm = round(haversineKm([from[1], from[2]], [to[1], to[2]]) * 1.3 + between(0.2, 0.8), 1);
      const durationMin = Math.max(5, Math.round((distanceKm / 22) * 60 + between(2, 8)));
      const fare = estimateFare(pricing, distanceKm, durationMin);

      const roll = random();
      const recent = now - requestedAt.getTime() < 40 * 60_000;
      const status = recent && roll < 0.6 ? pick(["accepted", "arriving", "in_progress"] as const) : roll < 0.12 ? "cancelled" : "completed";
      const driver = status === "cancelled" && random() < 0.4 ? null : pick(activeDrivers);
      const rider = pick(activeRiders);
      const acceptedAt = driver ? new Date(requestedAt.getTime() + int(20, 150) * 1000) : null;
      const startedAt = acceptedAt && status !== "cancelled" && status !== "accepted" && status !== "arriving" ? new Date(acceptedAt.getTime() + int(2, 7) * 60_000) : null;
      const completedAt = status === "completed" && startedAt ? new Date(startedAt.getTime() + durationMin * 60_000) : null;

      rides.push({
        code: rideCode(),
        rider: rider._id,
        driver: driver?._id ?? null,
        city: "tunis",
        status,
        pickup: { address: from[0], location: { type: "Point" as const, coordinates: [from[2], from[1]] as [number, number] } },
        dropoff: { address: to[0], location: { type: "Point" as const, coordinates: [to[2], to[1]] as [number, number] } },
        distanceKm,
        durationMin,
        fare,
        paymentMethod: random() < 0.9 ? ("cash" as const) : ("card" as const),
        requestedAt,
        acceptedAt,
        startedAt,
        completedAt,
        cancelledAt: status === "cancelled" ? new Date(requestedAt.getTime() + int(1, 6) * 60_000) : null,
        cancelledBy: status === "cancelled" ? pick(["rider", "rider", "driver", "system"] as const) : null,
        cancellationReason: status === "cancelled" ? pick(["Changement de programme", "Temps d'attente trop long", null]) : null,
        riderRating: status === "completed" && random() < 0.7 ? pick([5, 5, 5, 4, 4, 3]) : null,
        isDemo: true,
        createdAt: requestedAt,
        updatedAt: completedAt ?? requestedAt,
      });

      // Keep denormalised stats in sync with the generated rides.
      if (status === "completed" && driver && completedAt) {
        driver.stats.completedRides += 1;
        driver.stats.earnings = round(driver.stats.earnings + fare.driverEarnings);
        rider.stats.completedRides += 1;
        if (!rider.lastRideAt || rider.lastRideAt < completedAt) rider.lastRideAt = completedAt;
        const rating = rides[rides.length - 1].riderRating;
        if (rating) {
          driver.rating.average = round((driver.rating.average * driver.rating.count + rating) / (driver.rating.count + 1), 2);
          driver.rating.count += 1;
        }
        rider.rating.average = round((rider.rating.average * rider.rating.count + pick([5, 5, 4])) / (rider.rating.count + 1), 2);
        rider.rating.count += 1;
      }
    }
  }

  await Driver.insertMany(drivers, { ordered: true });
  await Rider.insertMany(riders, { ordered: true });
  await Ride.insertMany(rides, { ordered: false });
  await Activity.insertMany(
    drivers
      .filter((driver) => driver.status === "pending")
      .map((driver) => ({
        action: "driver.applied",
        actor: null,
        subject: { type: "driver", id: driver._id, label: `${driver.firstName} ${driver.lastName}` },
        createdAt: driver.createdAt,
      })),
  );

  console.log(`Seeded ${drivers.length} drivers, ${riders.length} riders and ${rides.length} rides (tagged isDemo).`);
}

async function main() {
  loadEnv();
  const { values } = parseArgs({ options: { reset: { type: "boolean", default: false } } });
  await connectToDatabase();
  await Promise.all([Driver.init(), Rider.init(), Ride.init(), Activity.init()]);
  await removeDemoData();
  if (!values.reset) await seed();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());
