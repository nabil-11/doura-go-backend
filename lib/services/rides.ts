import "server-only";

import { isValidObjectId, type QueryFilter } from "mongoose";
import { cache } from "react";

import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { Ride, type RideRecord } from "@/lib/db/models/ride";
import { Rider, type RiderRecord } from "@/lib/db/models/rider";
import { fromGeoPoint, type LatLng } from "@/lib/domain/geo";
import { ONGOING_RIDE_STATUSES, type RideFilter, type RideStatus } from "@/lib/domain/ride";
import { APP_TIME_ZONE, DEFAULT_CURRENCY } from "@/lib/i18n/format";
import { addDays, lastDayKeys, startOfDay, startOfMonth } from "@/lib/time";

import { escapeRegex, paginate, type Paginated } from "./query";

type PersonRef = { id: string; name: string } | null;

export type RideListItem = {
  id: string;
  code: string;
  status: RideStatus;
  rider: PersonRef;
  driver: PersonRef;
  pickup: string;
  dropoff: string;
  total: number;
  currency: string;
  paymentMethod: RideRecord["paymentMethod"];
  requestedAt: Date;
};

export type RideDetail = RideListItem & {
  city: string;
  pickupPoint: LatLng | null;
  dropoffPoint: LatLng | null;
  /** The streets the ride was priced on, in order. */
  route: LatLng[];
  distanceKm: number;
  durationMin: number;
  fare: RideRecord["fare"];
  riderPhone: string | null;
  driverPhone: string | null;
  acceptedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: RideRecord["cancelledBy"];
  cancellationReason: string | null;
  riderRating: number | null;
};

function filterFor(filter: RideFilter | undefined): QueryFilter<RideRecord> {
  switch (filter) {
    case "ongoing":
      return { status: { $in: [...ONGOING_RIDE_STATUSES] } };
    case "completed":
      return { status: "completed" };
    case "cancelled":
      return { status: "cancelled" };
    default:
      return {};
  }
}

async function peopleFor(rides: RideRecord[]) {
  const riderIds = [...new Set(rides.map((ride) => String(ride.rider)))];
  const driverIds = [...new Set(rides.filter((ride) => ride.driver).map((ride) => String(ride.driver)))];
  const [riders, drivers] = await Promise.all([
    Rider.find({ _id: { $in: riderIds } }).select("name phone").lean<RiderRecord[]>(),
    Driver.find({ _id: { $in: driverIds } }).select("firstName lastName phone").lean<DriverRecord[]>(),
  ]);
  return {
    riders: new Map(riders.map((rider) => [String(rider._id), rider])),
    drivers: new Map(drivers.map((driver) => [String(driver._id), driver])),
  };
}

function toListItem(ride: RideRecord, people: Awaited<ReturnType<typeof peopleFor>>): RideListItem {
  const rider = people.riders.get(String(ride.rider));
  const driver = ride.driver ? people.drivers.get(String(ride.driver)) : undefined;
  return {
    id: String(ride._id),
    code: ride.code,
    status: ride.status,
    rider: rider ? { id: String(rider._id), name: rider.name } : null,
    driver: driver ? { id: String(driver._id), name: `${driver.firstName} ${driver.lastName}` } : null,
    pickup: ride.pickup.address,
    dropoff: ride.dropoff.address,
    total: ride.fare.total,
    currency: ride.fare.currency ?? DEFAULT_CURRENCY,
    paymentMethod: ride.paymentMethod,
    requestedAt: ride.requestedAt,
  };
}

/**
 * Rides, newest first. `rider` and `driver` narrow it to one person's history,
 * which is what the record pages ask for — the same shape, the same sort, so a
 * ride reads identically wherever it is listed.
 */
export async function listRides(options: {
  filter?: RideFilter;
  q?: string;
  rider?: string;
  driver?: string;
  page: number;
  pageSize: number;
}): Promise<Paginated<RideListItem>> {
  await connectToDatabase();
  const query: QueryFilter<RideRecord> = filterFor(options.filter);
  if (options.q) query.code = new RegExp(escapeRegex(options.q), "i");
  // An id that could not name anything must match nothing, rather than being
  // dropped and quietly listing every ride on the platform.
  if (options.rider !== undefined) query.rider = isValidObjectId(options.rider) ? options.rider : null;
  if (options.driver !== undefined) query.driver = isValidObjectId(options.driver) ? options.driver : null;

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .sort({ requestedAt: -1 })
      .skip((options.page - 1) * options.pageSize)
      .limit(options.pageSize)
      .lean<RideRecord[]>(),
    Ride.countDocuments(query),
  ]);
  const people = await peopleFor(rides);
  return paginate(
    rides.map((ride) => toListItem(ride, people)),
    total,
    options.page,
    options.pageSize,
  );
}

export async function countRidesByFilter(q?: string) {
  await connectToDatabase();
  const base: QueryFilter<RideRecord> = q ? { code: new RegExp(escapeRegex(q), "i") } : {};
  const [all, ongoing, completed, cancelled] = await Promise.all([
    Ride.countDocuments(base),
    Ride.countDocuments({ ...base, ...filterFor("ongoing") }),
    Ride.countDocuments({ ...base, ...filterFor("completed") }),
    Ride.countDocuments({ ...base, ...filterFor("cancelled") }),
  ]);
  return { all, ongoing, completed, cancelled };
}

export async function getRide(id: string): Promise<RideDetail | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const ride = await Ride.findById(id).lean<RideRecord>();
  if (!ride) return null;
  const people = await peopleFor([ride]);
  const rider = people.riders.get(String(ride.rider));
  const driver = ride.driver ? people.drivers.get(String(ride.driver)) : undefined;
  return {
    ...toListItem(ride, people),
    city: ride.city,
    pickupPoint: fromGeoPoint(ride.pickup.location),
    dropoffPoint: fromGeoPoint(ride.dropoff.location),
    route: (ride.route?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })),
    distanceKm: ride.distanceKm,
    durationMin: ride.durationMin,
    fare: ride.fare,
    riderPhone: rider?.phone ?? null,
    driverPhone: driver?.phone ?? null,
    acceptedAt: ride.acceptedAt ?? null,
    startedAt: ride.startedAt ?? null,
    completedAt: ride.completedAt ?? null,
    cancelledAt: ride.cancelledAt ?? null,
    cancelledBy: ride.cancelledBy ?? null,
    cancellationReason: ride.cancellationReason ?? null,
    riderRating: ride.riderRating ?? null,
  };
}

export type RideStats = {
  ridesToday: number;
  ridesYesterday: number;
  completedSeries: { day: string; completed: number }[];
  completedTotal: number;
  commissionMonth: number;
  grossMonth: number;
  currency: string;
};

/** Numbers for the overview page. Days are counted in the business time zone. */
export const getRideStats = cache(async (days: number = 14): Promise<RideStats> => {
  await connectToDatabase();
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const seriesStart = addDays(today, -(days - 1));
  const monthStart = startOfMonth(now);

  const [ridesToday, ridesYesterday, seriesRows, monthRows] = await Promise.all([
    Ride.countDocuments({ requestedAt: { $gte: today } }),
    Ride.countDocuments({ requestedAt: { $gte: yesterday, $lt: today } }),
    Ride.aggregate<{ _id: string; count: number }>([
      { $match: { status: "completed", completedAt: { $gte: seriesStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt", timezone: APP_TIME_ZONE } },
          count: { $sum: 1 },
        },
      },
    ]),
    Ride.aggregate<{ _id: null; commission: number; gross: number }>([
      { $match: { status: "completed", completedAt: { $gte: monthStart } } },
      { $group: { _id: null, commission: { $sum: "$fare.commission" }, gross: { $sum: "$fare.total" } } },
    ]),
  ]);

  const counts = new Map(seriesRows.map((row) => [row._id, row.count]));
  const completedSeries = lastDayKeys(days, now).map((day) => ({ day, completed: counts.get(day) ?? 0 }));

  return {
    ridesToday,
    ridesYesterday,
    completedSeries,
    completedTotal: completedSeries.reduce((sum, point) => sum + point.completed, 0),
    commissionMonth: Math.round((monthRows[0]?.commission ?? 0) * 1000) / 1000,
    grossMonth: Math.round((monthRows[0]?.gross ?? 0) * 1000) / 1000,
    currency: DEFAULT_CURRENCY,
  };
});
