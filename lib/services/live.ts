import "server-only";

import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { Ride, type RideRecord } from "@/lib/db/models/ride";
import { heartbeatCutoff } from "@/lib/domain/dispatch";
import type { DriverAvailability } from "@/lib/domain/driver";
import { fromGeoPoint, type LatLng } from "@/lib/domain/geo";
import type { RideStatus } from "@/lib/domain/ride";

/**
 * A snapshot of what is happening right now, for the operations map: who is
 * out there, who is carrying someone, and which requests are still looking for
 * a driver.
 */

export type LiveDriver = {
  id: string;
  name: string;
  phone: string;
  city: string;
  availability: DriverAvailability;
  plateNumber: string | null;
  location: LatLng;
  lastSeenAt: Date | null;
  /** Marked online, but the app has stopped reporting — dispatch skips them. */
  stale: boolean;
};

export type LiveRide = {
  id: string;
  code: string;
  status: RideStatus;
  city: string;
  pickup: string;
  pickupPoint: LatLng | null;
  dropoffPoint: LatLng | null;
  driverId: string | null;
  requestedAt: Date;
  waitingSeconds: number;
};

export type LiveSnapshot = {
  at: string;
  drivers: LiveDriver[];
  rides: LiveRide[];
  counts: { online: number; onTrip: number; stale: number; waiting: number; ongoing: number };
};

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  await connectToDatabase();
  const now = new Date();
  const cutoff = heartbeatCutoff(now);

  const [drivers, rides] = await Promise.all([
    Driver.find({
      status: "active",
      availability: { $in: ["online", "on_trip"] },
      location: { $exists: true },
    })
      .select("firstName lastName phone city availability vehicle.plateNumber location lastSeenAt")
      .limit(500)
      .lean<DriverRecord[]>(),
    Ride.find({ status: { $in: ["requested", "accepted", "arriving", "in_progress"] } })
      .select("code status city pickup dropoff driver requestedAt")
      .sort({ requestedAt: 1 })
      .limit(200)
      .lean<RideRecord[]>(),
  ]);

  const liveDrivers = drivers.flatMap((driver): LiveDriver[] => {
    const location = fromGeoPoint(driver.location);
    if (!location) return [];
    return [
      {
        id: String(driver._id),
        name: `${driver.firstName} ${driver.lastName}`.trim(),
        phone: driver.phone,
        city: driver.city,
        availability: driver.availability,
        plateNumber: driver.vehicle?.plateNumber ?? null,
        location,
        lastSeenAt: driver.lastSeenAt ?? null,
        stale: !driver.lastSeenAt || driver.lastSeenAt < cutoff,
      },
    ];
  });

  const liveRides = rides.map((ride): LiveRide => ({
    id: String(ride._id),
    code: ride.code,
    status: ride.status,
    city: ride.city,
    pickup: ride.pickup.address,
    pickupPoint: fromGeoPoint(ride.pickup.location),
    dropoffPoint: fromGeoPoint(ride.dropoff.location),
    driverId: ride.driver ? String(ride.driver) : null,
    requestedAt: ride.requestedAt,
    waitingSeconds: Math.max(0, Math.round((now.getTime() - ride.requestedAt.getTime()) / 1000)),
  }));

  return {
    at: now.toISOString(),
    drivers: liveDrivers,
    rides: liveRides,
    counts: {
      online: liveDrivers.filter((driver) => driver.availability === "online" && !driver.stale).length,
      onTrip: liveDrivers.filter((driver) => driver.availability === "on_trip").length,
      stale: liveDrivers.filter((driver) => driver.stale).length,
      waiting: liveRides.filter((ride) => ride.status === "requested").length,
      ongoing: liveRides.filter((ride) => ride.status !== "requested").length,
    },
  };
}
