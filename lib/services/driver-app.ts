import "server-only";

import { ApiError } from "@/lib/api/errors";
import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { Ride } from "@/lib/db/models/ride";
import type { RiderRecord } from "@/lib/db/models/rider";
import { getApprovalChecklist, type DriverAvailability } from "@/lib/domain/driver";
import { fromGeoPoint, toGeoPoint, type LatLng } from "@/lib/domain/geo";
import { DEFAULT_CURRENCY } from "@/lib/i18n/format";
import { addDays, startOfDay } from "@/lib/time";

import { balanceState } from "./balance";
import { assertCanRide } from "./ride-flow";

/** What the driver app may set. `on_trip` is the platform's to give. */
export type SettableAvailability = Extract<DriverAvailability, "online" | "offline">;

/**
 * Going online means "dispatch may send me a ride", so it needs a position:
 * the app sends one with the switch, and keeps it fresh with the heartbeat
 * below. A driver in the middle of a ride cannot disappear.
 */
export async function setAvailability(
  driver: DriverRecord,
  availability: SettableAvailability,
  location?: LatLng,
) {
  await connectToDatabase();

  if (driver.availability === "on_trip") throw new ApiError("rideInProgress");
  if (availability === "online") {
    if (driver.status !== "active") throw new ApiError("driverNotActive");
    await assertCanRide(driver);
    if (!location && !driver.location) throw new ApiError("invalidRequest", { location: "required to go online" });
  }

  const now = new Date();
  const updated = await Driver.findByIdAndUpdate(
    driver._id,
    {
      $set: {
        availability,
        ...(location ? { location: toGeoPoint(location), lastSeenAt: now } : {}),
        ...(availability === "online" && !location ? { lastSeenAt: now } : {}),
      },
    },
    { returnDocument: "after" },
  ).lean<DriverRecord>();

  if (!updated) throw new ApiError("notFound");
  return updated;
}

/** Position heartbeat. Kept cheap: one indexed write, no reads. */
export async function updateLocation(driverId: string, location: LatLng) {
  await connectToDatabase();
  const now = new Date();
  await Driver.updateOne(
    { _id: driverId },
    { $set: { location: toGeoPoint(location), lastSeenAt: now } },
  );
  return now;
}

export type DriverEarnings = {
  currency: string;
  today: { rides: number; earnings: number };
  last7Days: { rides: number; earnings: number };
  allTime: { rides: number; earnings: number };
};

export async function getDriverEarnings(driver: DriverRecord): Promise<DriverEarnings> {
  await connectToDatabase();
  const today = startOfDay();
  const weekStart = addDays(today, -6);

  const rows = await Ride.aggregate<{ _id: "today" | "week"; rides: number; earnings: number }>([
    { $match: { driver: driver._id, status: "completed", completedAt: { $gte: weekStart } } },
    {
      $facet: {
        today: [
          { $match: { completedAt: { $gte: today } } },
          { $group: { _id: null, rides: { $sum: 1 }, earnings: { $sum: "$fare.driverEarnings" } } },
        ],
        week: [{ $group: { _id: null, rides: { $sum: 1 }, earnings: { $sum: "$fare.driverEarnings" } } }],
      },
    },
    {
      $project: {
        buckets: [
          { _id: "today", rides: { $ifNull: [{ $first: "$today.rides" }, 0] }, earnings: { $ifNull: [{ $first: "$today.earnings" }, 0] } },
          { _id: "week", rides: { $ifNull: [{ $first: "$week.rides" }, 0] }, earnings: { $ifNull: [{ $first: "$week.earnings" }, 0] } },
        ],
      },
    },
    { $unwind: "$buckets" },
    { $replaceRoot: { newRoot: "$buckets" } },
  ]);

  const bucket = (key: "today" | "week") => {
    const row = rows.find((entry) => entry._id === key);
    return { rides: row?.rides ?? 0, earnings: round3(row?.earnings ?? 0) };
  };

  return {
    currency: DEFAULT_CURRENCY,
    today: bucket("today"),
    last7Days: bucket("week"),
    allTime: {
      rides: driver.stats?.completedRides ?? 0,
      earnings: round3(driver.stats?.earnings ?? 0),
    },
  };
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

// ---------------------------------------------------------------- profiles ---

/**
 * The driver's own record. A driver whose application is still being reviewed
 * sees exactly what is missing, which is the whole home screen before approval.
 */
export async function toDriverProfile(driver: DriverRecord) {
  const checklist = getApprovalChecklist(driver);
  return {
    id: String(driver._id),
    firstName: driver.firstName,
    lastName: driver.lastName,
    phone: driver.phone,
    email: driver.email ?? null,
    city: driver.city,
    status: driver.status,
    availability: driver.availability,
    photoUrl: driver.documents?.photo?.url ?? null,
    rating: { average: driver.rating?.average ?? 0, count: driver.rating?.count ?? 0 },
    stats: {
      completedRides: driver.stats?.completedRides ?? 0,
      earnings: round3(driver.stats?.earnings ?? 0),
    },
    vehicle: {
      type: driver.vehicle?.type ?? null,
      brand: driver.vehicle?.brand ?? null,
      model: driver.vehicle?.model ?? null,
      year: driver.vehicle?.year ?? null,
      color: driver.vehicle?.color ?? null,
      plateNumber: driver.vehicle?.plateNumber ?? null,
    },
    license: {
      number: driver.license?.number ?? null,
      expiresAt: driver.license?.expiresAt ?? null,
    },
    location: fromGeoPoint(driver.location),
    lastSeenAt: driver.lastSeenAt ?? null,
    // What they owe Doura Go on cash rides, and whether it has stopped them.
    balance: await balanceState(driver),
    onboarding: {
      ready: checklist.ready,
      documents: checklist.documents,
      license: checklist.license,
      vehicle: checklist.vehicle,
      missingDocuments: checklist.missingDocuments,
      /** Set when an application was rejected or an account suspended. */
      reviewReason: driver.review?.reason ?? null,
    },
  };
}

export function toRiderProfile(rider: RiderRecord) {
  return {
    id: String(rider._id),
    name: rider.name,
    phone: rider.phone,
    email: rider.email ?? null,
    status: rider.status,
    rating: { average: rider.rating?.average ?? 0, count: rider.rating?.count ?? 0 },
    stats: { completedRides: rider.stats?.completedRides ?? 0 },
    lastRideAt: rider.lastRideAt ?? null,
    createdAt: rider.createdAt,
  };
}
