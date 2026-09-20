import "server-only";

import type { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { Ride, type RideRecord } from "@/lib/db/models/ride";
import { DISPATCH, heartbeatCutoff, offerExpiry } from "@/lib/domain/dispatch";
import { SYSTEM_CANCELLATIONS } from "@/lib/domain/ride";

/**
 * Matching a ride to a driver.
 *
 * A request is broadcast to the few nearest drivers at once and the first to
 * accept wins — the accept is a conditional update, so two taps on two phones
 * can never both succeed. If nobody takes it within the offer window, the next
 * round goes out to the next nearest, skipping whoever already declined. After
 * a few empty rounds the platform gives up and cancels the ride itself.
 *
 * Re-dispatch is lazy: it happens when the waiting rider's app polls the ride.
 * That needs no scheduler, and a ride nobody is waiting on costs nothing.
 */

async function findCandidates(ride: RideRecord, limit: number) {
  const declined = ride.dispatch?.declinedBy ?? [];
  const drivers = await Driver.find({
    status: "active",
    availability: "online",
    city: ride.city,
    lastSeenAt: { $gte: heartbeatCutoff() },
    ...(declined.length ? { _id: { $nin: declined } } : {}),
    location: {
      $near: {
        $geometry: ride.pickup.location,
        $maxDistance: DISPATCH.radiusKm * 1000,
      },
    },
  })
    .select("_id")
    .limit(limit)
    .lean<Pick<DriverRecord, "_id">[]>();

  return drivers.map((driver) => driver._id);
}

export type DispatchOutcome = { offered: number; round: number; exhausted: boolean };

/** Sends (or re-sends) a request to the nearest available drivers. */
export async function dispatchRide(ride: RideRecord): Promise<DispatchOutcome> {
  await connectToDatabase();
  const round = (ride.dispatch?.round ?? 0) + 1;

  if (round > DISPATCH.maxRounds) {
    await giveUp(ride._id);
    return { offered: 0, round: round - 1, exhausted: true };
  }

  const candidates = await findCandidates(ride, DISPATCH.candidates);
  const now = new Date();

  await Ride.updateOne(
    { _id: ride._id, status: "requested" },
    {
      $set: {
        "dispatch.round": round,
        "dispatch.candidates": candidates,
        "dispatch.offeredAt": now,
        "dispatch.expiresAt": offerExpiry(now),
      },
    },
  );

  return { offered: candidates.length, round, exhausted: false };
}

async function giveUp(rideId: Types.ObjectId) {
  await Ride.updateOne(
    { _id: rideId, status: "requested" },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: "system",
        cancellationReason: SYSTEM_CANCELLATIONS.noDriverFound,
        "dispatch.candidates": [],
        "dispatch.expiresAt": null,
      },
    },
  );
}

/**
 * Moves a waiting ride along if its offer window has closed. Returns the ride
 * as it stands afterwards, so a polling client always sees a current state.
 */
export async function refreshDispatch(ride: RideRecord): Promise<RideRecord> {
  if (ride.status !== "requested") return ride;

  const expiresAt = ride.dispatch?.expiresAt;
  if (expiresAt && expiresAt.getTime() > Date.now()) return ride;

  await dispatchRide(ride);
  return (await Ride.findById(ride._id).lean<RideRecord>()) ?? ride;
}

/** Open offers for one driver, nearest first. */
export async function offersForDriver(driverId: string) {
  await connectToDatabase();
  return Ride.find({
    status: "requested",
    "dispatch.candidates": driverId,
    "dispatch.expiresAt": { $gt: new Date() },
  })
    .sort({ requestedAt: 1 })
    .limit(DISPATCH.candidates)
    .lean<RideRecord[]>();
}

/** Takes a driver out of the running for one ride, without ending it. */
export async function declineOffer(rideId: string, driverId: string) {
  await connectToDatabase();
  await Ride.updateOne(
    { _id: rideId, status: "requested" },
    {
      $addToSet: { "dispatch.declinedBy": driverId },
      $pull: { "dispatch.candidates": driverId },
    },
  );
}
