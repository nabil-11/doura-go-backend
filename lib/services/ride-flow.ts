import "server-only";

import { isValidObjectId, Types } from "mongoose";

import { ApiError } from "@/lib/api/errors";
import { cityForPoint } from "@/lib/config/site";
import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { Ride, type RideRecord } from "@/lib/db/models/ride";
import { Rider, type RiderRecord } from "@/lib/db/models/rider";
import { DISPATCH } from "@/lib/domain/dispatch";
import { estimateFare, isOverCreditLimit, type FareBreakdown } from "@/lib/domain/pricing";
import { fromGeoPoint, haversineKm, toGeoPoint, type LatLng } from "@/lib/domain/geo";
import {
  DRIVER_RELEASABLE,
  FEE_BEARING_CANCELLATION,
  ONGOING_RIDE_STATUSES,
  RIDER_CANCELLABLE,
  RIDE_STEPS,
  rideCode,
  type PaymentMethod,
  type RideStatus,
  type RideStep,
} from "@/lib/domain/ride";

import { dispatchRide, refreshDispatch } from "./dispatch";
import { getRoute, type Route } from "./routing";
import { getPricingValues } from "./pricing";
import { paginate, type Paginated } from "./query";

export type StopInput = { address: string; lat: number; lng: number };

/** Statuses where the two sides are actively dealing with each other. */
const LIVE_STATUSES: readonly RideRecord["status"][] = ["accepted", "arriving", "in_progress"];

function objectId(id: string) {
  if (!isValidObjectId(id)) throw new ApiError("notFound");
  return new Types.ObjectId(id);
}

// -------------------------------------------------------------- estimates ---

export type RideEstimate = {
  city: string;
  distanceKm: number;
  durationMin: number;
  fare: FareBreakdown;
  cancellationFee: number;
  /** The path along the streets, so the rider sees the trip, not a chord. */
  route: LatLng[];
  routeSource: Route["source"];
};

/** Prices a trip before it is requested. Nothing is written. */
export async function estimateRide(pickup: LatLng, dropoff: LatLng): Promise<RideEstimate> {
  const city = cityForPoint(pickup);
  if (!city) throw new ApiError("outsideServiceArea");

  const [route, values] = await Promise.all([getRoute(pickup, dropoff), getPricingValues()]);
  return {
    city: city.id,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    fare: estimateFare(values, route.distanceKm, route.durationMin),
    cancellationFee: values.cancellationFee,
    route: route.geometry,
    routeSource: route.source,
  };
}

// ---------------------------------------------------------------- request ---

export async function requestRide(input: {
  riderId: string;
  pickup: StopInput;
  dropoff: StopInput;
  paymentMethod: PaymentMethod;
}): Promise<RideRecord> {
  await connectToDatabase();

  const ongoing = await Ride.exists({
    rider: objectId(input.riderId),
    status: { $in: [...ONGOING_RIDE_STATUSES] },
  });
  if (ongoing) throw new ApiError("rideInProgress");

  const estimate = await estimateRide(input.pickup, input.dropoff);
  const now = new Date();

  const ride = await createWithUniqueCode({
    rider: objectId(input.riderId),
    city: estimate.city,
    status: "requested",
    pickup: { address: input.pickup.address, location: toGeoPoint(input.pickup) },
    dropoff: { address: input.dropoff.address, location: toGeoPoint(input.dropoff) },
    distanceKm: estimate.distanceKm,
    durationMin: estimate.durationMin,
    route: estimate.route.length
      ? { coordinates: estimate.route.map((point) => [point.lng, point.lat] as [number, number]), source: estimate.routeSource }
      : undefined,
    fare: estimate.fare,
    paymentMethod: input.paymentMethod,
    requestedAt: now,
    dispatch: { round: 0, candidates: [], declinedBy: [] },
  });

  await dispatchRide(ride);
  return (await Ride.findById(ride._id).lean<RideRecord>()) ?? ride;
}

/** Ride codes are random and short, so a collision is retried rather than prevented. */
async function createWithUniqueCode(base: Omit<Parameters<typeof Ride.create>[0], "code">) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const created = await Ride.create({ ...base, code: rideCode() });
      return created.toObject() as RideRecord;
    } catch (error) {
      const duplicate = error instanceof Error && "code" in error && (error as { code?: number }).code === 11000;
      if (!duplicate || attempt === 3) throw error;
    }
  }
  throw new Error("unreachable");
}

// ------------------------------------------------------------------ reads ---

async function loadRide(id: string) {
  await connectToDatabase();
  const ride = await Ride.findById(objectId(id)).lean<RideRecord>();
  if (!ride) throw new ApiError("notFound");
  return ride;
}

function assertRider(ride: RideRecord, riderId: string) {
  if (String(ride.rider) !== riderId) throw new ApiError("notFound");
}

function assertDriver(ride: RideRecord, driverId: string) {
  if (!ride.driver || String(ride.driver) !== driverId) throw new ApiError("notFound");
}

export type RideViewer = { audience: "rider" | "driver"; id: string };

/**
 * One ride, as its rider or its driver may see it. A waiting rider also nudges
 * dispatch forward here — the poll that asks "found anyone yet?" is what starts
 * the next round.
 */
export async function getRideFor(viewer: RideViewer, id: string) {
  let ride = await loadRide(id);
  if (viewer.audience === "rider") {
    assertRider(ride, viewer.id);
    ride = await refreshDispatch(ride);
  } else {
    assertDriver(ride, viewer.id);
  }
  return ride;
}

export async function listRidesFor(
  viewer: RideViewer,
  options: { page: number; pageSize: number },
): Promise<Paginated<RideRecord>> {
  await connectToDatabase();
  const filter =
    viewer.audience === "rider" ? { rider: objectId(viewer.id) } : { driver: objectId(viewer.id) };

  const [rides, total] = await Promise.all([
    Ride.find(filter)
      .sort({ requestedAt: -1 })
      .skip((options.page - 1) * options.pageSize)
      .limit(options.pageSize)
      .lean<RideRecord[]>(),
    Ride.countDocuments(filter),
  ]);
  return paginate(rides, total, options.page, options.pageSize);
}

/** The ride a rider or driver is in the middle of, if any. */
export async function getActiveRide(viewer: RideViewer) {
  await connectToDatabase();
  const filter =
    viewer.audience === "rider" ? { rider: objectId(viewer.id) } : { driver: objectId(viewer.id) };
  const ride = await Ride.findOne({ ...filter, status: { $in: [...ONGOING_RIDE_STATUSES] } })
    .sort({ requestedAt: -1 })
    .lean<RideRecord>();
  if (!ride) return null;
  return viewer.audience === "rider" ? refreshDispatch(ride) : ride;
}

// ------------------------------------------------------------- the driver ---

/**
 * Takes a ride off the board. Conditional on the ride still being unassigned
 * and on this driver still being among the candidates, so of several drivers
 * tapping at once exactly one succeeds and the rest see `offerExpired`.
 */
export async function acceptRide(driver: DriverRecord, rideId: string): Promise<RideRecord> {
  await connectToDatabase();
  if (driver.availability === "on_trip") throw new ApiError("rideInProgress");
  if (driver.availability !== "online") throw new ApiError("driverOffline");
  await assertCanRide(driver);

  const now = new Date();
  const ride = await Ride.findOneAndUpdate(
    {
      _id: objectId(rideId),
      status: "requested",
      driver: null,
      "dispatch.candidates": driver._id,
      "dispatch.expiresAt": { $gt: now },
    },
    {
      $set: {
        status: "accepted",
        driver: driver._id,
        acceptedAt: now,
        "dispatch.candidates": [],
        "dispatch.expiresAt": null,
      },
    },
    { returnDocument: "after" },
  ).lean<RideRecord>();

  if (!ride) throw new ApiError("offerExpired");

  await Driver.updateOne({ _id: driver._id }, { $set: { availability: "on_trip" } });
  return ride;
}

/**
 * Cash rides leave the commission with the driver, so it builds up as a debt.
 * Past the limit the office has set, the account stops taking rides until it
 * is settled — the check lives here so it guards every way onto the road.
 */
export async function assertCanRide(driver: DriverRecord) {
  const values = await getPricingValues();
  const due = driver.balance?.commissionDue ?? 0;
  if (!isOverCreditLimit(due, values.commissionCreditLimit)) return;
  throw new ApiError("commissionDue", {
    due: due.toFixed(3),
    limit: values.commissionCreditLimit.toFixed(3),
    currency: values.currency,
  });
}

export type StepResult = { ride: RideRecord; fareChanged: boolean };

/**
 * Moves a ride one step along (arrive, start, complete). Each step names the
 * statuses it may start from and is applied as a conditional update, so a retry
 * from a phone that lost signal can't skip ahead or double-count anything.
 */
export async function advanceRide(
  driver: DriverRecord,
  rideId: string,
  step: RideStep,
  actuals?: { distanceKm?: number; durationMin?: number },
): Promise<StepResult> {
  const transition = RIDE_STEPS[step];
  const from = transition.from as readonly RideStatus[];
  await connectToDatabase();

  const current = await loadRide(rideId);
  assertDriver(current, String(driver._id));
  if (!from.includes(current.status)) throw new ApiError("invalidTransition");

  const now = new Date();
  const update: Record<string, unknown> = { status: transition.to };
  if (transition.stamp) update[transition.stamp] = now;

  let fareChanged = false;
  if (step === "complete") {
    const settled = await settleFare(current, actuals);
    if (settled) {
      Object.assign(update, settled);
      fareChanged = true;
    }
  }

  const ride = await Ride.findOneAndUpdate(
    { _id: current._id, driver: driver._id, status: { $in: [...from] } },
    { $set: update },
    { returnDocument: "after" },
  ).lean<RideRecord>();

  if (!ride) throw new ApiError("invalidTransition");

  if (step === "complete") {
    // On a cash ride the driver has the whole fare in hand, so the platform's
    // share is added to what they owe rather than taken from anything.
    const owed = ride.paymentMethod === "cash" ? ride.fare.commission : 0;
    await Promise.all([
      Driver.updateOne(
        { _id: driver._id },
        {
          $set: { availability: "online" },
          $inc: {
            "stats.completedRides": 1,
            "stats.earnings": ride.fare.driverEarnings,
            ...(owed > 0 ? { "balance.commissionDue": owed } : {}),
          },
        },
      ),
      Rider.updateOne(
        { _id: ride.rider },
        { $set: { lastRideAt: now }, $inc: { "stats.completedRides": 1 } },
      ),
    ]);
  }

  return { ride, fareChanged };
}

/**
 * Re-prices a finished ride on what was actually ridden. The driver app reports
 * it, so the figures are capped at twice the estimate (and never below the
 * minimum fare) — a wrong or tampered reading can't invent a large fare.
 */
async function settleFare(ride: RideRecord, actuals?: { distanceKm?: number; durationMin?: number }) {
  if (!actuals || (actuals.distanceKm === undefined && actuals.durationMin === undefined)) return null;

  const distanceKm = clamp(actuals.distanceKm ?? ride.distanceKm, 0, ride.distanceKm * 2);
  const durationMin = clamp(actuals.durationMin ?? ride.durationMin, 0, ride.durationMin * 2);
  if (distanceKm === ride.distanceKm && durationMin === ride.durationMin) return null;

  const values = await getPricingValues();
  return { distanceKm, durationMin, fare: estimateFare(values, distanceKm, durationMin) };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------- calling it off ---

export type CancelResult = { ride: RideRecord; fee: number; released: boolean };

/**
 * A rider ends the ride outright — with a fee once a driver is already on the
 * way. A driver instead hands it back: the ride returns to the pool, they are
 * not offered it again, and the search resumes for the rider.
 */
export async function cancelRide(
  viewer: RideViewer,
  rideId: string,
  reason?: string,
): Promise<CancelResult> {
  const ride = await loadRide(rideId);
  const now = new Date();

  if (viewer.audience === "rider") {
    assertRider(ride, viewer.id);
    if (!RIDER_CANCELLABLE.includes(ride.status)) throw new ApiError("invalidTransition");

    const fee = FEE_BEARING_CANCELLATION.includes(ride.status)
      ? (await getPricingValues()).cancellationFee
      : 0;

    const updated = await Ride.findOneAndUpdate(
      { _id: ride._id, status: { $in: [...RIDER_CANCELLABLE] } },
      {
        $set: {
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: "rider",
          cancellationReason: reason?.trim() || null,
          cancellationFee: fee || null,
          "dispatch.candidates": [],
          "dispatch.expiresAt": null,
        },
      },
      { returnDocument: "after" },
    ).lean<RideRecord>();
    if (!updated) throw new ApiError("invalidTransition");

    if (ride.driver) await Driver.updateOne({ _id: ride.driver }, { $set: { availability: "online" } });
    return { ride: updated, fee, released: false };
  }

  assertDriver(ride, viewer.id);
  if (!DRIVER_RELEASABLE.includes(ride.status)) throw new ApiError("invalidTransition");

  const released = await Ride.findOneAndUpdate(
    { _id: ride._id, driver: objectId(viewer.id), status: { $in: [...DRIVER_RELEASABLE] } },
    {
      $set: { status: "requested", driver: null, acceptedAt: null, "dispatch.expiresAt": null },
      $addToSet: { "dispatch.declinedBy": objectId(viewer.id) },
    },
    { returnDocument: "after" },
  ).lean<RideRecord>();
  if (!released) throw new ApiError("invalidTransition");

  await Driver.updateOne({ _id: objectId(viewer.id) }, { $set: { availability: "online" } });
  await dispatchRide(released);

  const ridePool = (await Ride.findById(ride._id).lean<RideRecord>()) ?? released;
  return { ride: ridePool, fee: 0, released: true };
}

// ----------------------------------------------------------------- rating ---

export async function rateRide(riderId: string, rideId: string, rating: number): Promise<RideRecord> {
  const ride = await loadRide(rideId);
  assertRider(ride, riderId);
  if (ride.status !== "completed") throw new ApiError("invalidTransition");
  if (ride.riderRating != null) throw new ApiError("alreadyRated");

  const updated = await Ride.findOneAndUpdate(
    { _id: ride._id, status: "completed", riderRating: null },
    { $set: { riderRating: rating } },
    { returnDocument: "after" },
  ).lean<RideRecord>();
  if (!updated) throw new ApiError("alreadyRated");

  if (updated.driver) await addRating(String(updated.driver), rating);
  return updated;
}

/**
 * Folds one score into a running average, in a single atomic update. An
 * aggregation pipeline reads the current count and average as it writes, so no
 * two ratings arriving together can overwrite each other's work — every
 * expression here sees the document as it was before this update.
 */
async function addRating(driverId: string, rating: number) {
  const count = { $ifNull: ["$rating.count", 0] };
  const average = { $ifNull: ["$rating.average", 0] };
  await Driver.updateOne(
    { _id: objectId(driverId) },
    [
      {
        $set: {
          "rating.count": { $add: [count, 1] },
          "rating.average": {
            $round: [
              { $divide: [{ $add: [{ $multiply: [average, count] }, rating] }, { $add: [count, 1] }] },
              2,
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
}

// ------------------------------------------------------------ serialisation ---

type Party = { rider?: RiderRecord | null; driver?: DriverRecord | null };

export async function partiesFor(rides: RideRecord[]): Promise<Map<string, Party>> {
  await connectToDatabase();
  const riderIds = [...new Set(rides.map((ride) => String(ride.rider)))];
  const driverIds = [...new Set(rides.filter((ride) => ride.driver).map((ride) => String(ride.driver)))];

  const [riders, drivers] = await Promise.all([
    Rider.find({ _id: { $in: riderIds } }).select("name phone rating").lean<RiderRecord[]>(),
    Driver.find({ _id: { $in: driverIds } })
      .select("firstName lastName phone rating vehicle documents.photo location lastSeenAt")
      .lean<DriverRecord[]>(),
  ]);

  const riderMap = new Map(riders.map((rider) => [String(rider._id), rider]));
  const driverMap = new Map(drivers.map((driver) => [String(driver._id), driver]));

  return new Map(
    rides.map((ride) => [
      String(ride._id),
      {
        rider: riderMap.get(String(ride.rider)) ?? null,
        driver: ride.driver ? (driverMap.get(String(ride.driver)) ?? null) : null,
      },
    ]),
  );
}

function stop(value: RideRecord["pickup"]) {
  const point = fromGeoPoint(value.location);
  return { address: value.address, lat: point?.lat ?? null, lng: point?.lng ?? null };
}

/**
 * The JSON shape both apps read. Contact details and live position are only
 * included while the ride is happening: before a driver accepts there is nobody
 * to show, and once it is over neither side needs the other's number.
 */
export function toRideResource(ride: RideRecord, party: Party | undefined, audience: "rider" | "driver") {
  const live = LIVE_STATUSES.includes(ride.status);
  const driver = party?.driver;
  const rider = party?.rider;

  return {
    id: String(ride._id),
    code: ride.code,
    status: ride.status,
    city: ride.city,
    pickup: stop(ride.pickup),
    dropoff: stop(ride.dropoff),
    distanceKm: ride.distanceKm,
    durationMin: ride.durationMin,
    route: (ride.route?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })),
    fare: ride.fare,
    paymentMethod: ride.paymentMethod,
    cancellationFee: ride.cancellationFee ?? null,
    requestedAt: ride.requestedAt,
    acceptedAt: ride.acceptedAt ?? null,
    startedAt: ride.startedAt ?? null,
    completedAt: ride.completedAt ?? null,
    cancelledAt: ride.cancelledAt ?? null,
    cancelledBy: ride.cancelledBy ?? null,
    cancellationReason: ride.cancellationReason ?? null,
    riderRating: ride.riderRating ?? null,

    driver: driver
      ? {
          id: String(driver._id),
          firstName: driver.firstName,
          photoUrl: driver.documents?.photo?.url ?? null,
          rating: driver.rating?.average ?? 0,
          vehicle: {
            type: driver.vehicle?.type ?? null,
            brand: driver.vehicle?.brand ?? null,
            model: driver.vehicle?.model ?? null,
            color: driver.vehicle?.color ?? null,
            plateNumber: driver.vehicle?.plateNumber ?? null,
          },
          ...(audience === "rider" && live
            ? { phone: driver.phone, location: fromGeoPoint(driver.location), lastSeenAt: driver.lastSeenAt ?? null }
            : {}),
        }
      : null,

    rider: rider
      ? {
          id: String(rider._id),
          name: rider.name,
          rating: rider.rating?.average ?? 0,
          ...(audience === "driver" && live ? { phone: rider.phone } : {}),
        }
      : null,

    // Only meaningful while a rider is waiting for someone to accept.
    search:
      ride.status === "requested"
        ? {
            round: ride.dispatch?.round ?? 0,
            maxRounds: DISPATCH.maxRounds,
            expiresAt: ride.dispatch?.expiresAt ?? null,
          }
        : null,
  };
}

/** A ride as it appears on a driver's offer list, with the distance to pickup. */
export function toOfferResource(ride: RideRecord, from: LatLng | null) {
  const pickup = fromGeoPoint(ride.pickup.location);
  return {
    id: String(ride._id),
    code: ride.code,
    pickup: stop(ride.pickup),
    dropoff: stop(ride.dropoff),
    distanceKm: ride.distanceKm,
    durationMin: ride.durationMin,
    earnings: ride.fare.driverEarnings,
    total: ride.fare.total,
    currency: ride.fare.currency,
    paymentMethod: ride.paymentMethod,
    pickupDistanceKm:
      from && pickup ? Math.round(haversineKm(from, pickup) * 100) / 100 : null,
    expiresAt: ride.dispatch?.expiresAt ?? null,
    requestedAt: ride.requestedAt,
  };
}
