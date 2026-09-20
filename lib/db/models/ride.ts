import { Schema, model, models, type Model, type Types } from "mongoose";

import {
  CANCELLED_BY,
  PAYMENT_METHODS,
  RIDE_STATUSES,
  type CancelledBy,
  type PaymentMethod,
  type RideStatus,
} from "../../domain/ride";
import { pointSchema, type GeoPoint } from "./shared";

export interface RideStop {
  address: string;
  location: GeoPoint;
}

/**
 * A code the rider holds and the driver has to obtain from them, plus how many
 * wrong guesses are left. `usedAt` is set once it has done its job, so the same
 * four digits can never move a ride twice.
 */
export type Handshake = { code: string; attempts: number; usedAt?: Date | null };

export interface RideRecord {
  _id: Types.ObjectId;
  /** Short human-friendly reference, e.g. "DG-7F3K2Q" */
  code: string;
  /**
   * The two handovers. Shown only to the rider: the driver has to be given
   * them face to face, which is what makes starting and finishing a ride
   * evidence that the two were together.
   */
  handover?: { start: Handshake; finish: Handshake } | null;
  rider: Types.ObjectId;
  driver?: Types.ObjectId | null;
  city: string;
  status: RideStatus;
  pickup: RideStop;
  dropoff: RideStop;
  distanceKm: number;
  durationMin: number;
  /**
   * The path along the streets, as it was when the ride was priced. Stored so
   * the apps and the backoffice can draw it without asking the router again —
   * and so a fare queried months later can be checked against the route it was
   * actually based on.
   */
  route?: { coordinates: [number, number][]; source: string } | null;
  fare: {
    base: number;
    distance: number;
    time: number;
    bookingFee: number;
    total: number;
    commission: number;
    driverEarnings: number;
    currency: string;
    /** True when the short-ride price was charged instead of the meter. */
    flat?: boolean;
  };
  paymentMethod: PaymentMethod;
  requestedAt: Date;
  acceptedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledBy?: CancelledBy | null;
  cancellationReason?: string | null;
  /** Charged when a rider calls off a ride a driver is already riding to. */
  cancellationFee?: number | null;
  riderRating?: number | null;
  /** Who is being offered this ride right now (see lib/services/dispatch.ts). */
  dispatch?: {
    round: number;
    candidates: Types.ObjectId[];
    declinedBy: Types.ObjectId[];
    offeredAt?: Date | null;
    expiresAt?: Date | null;
  } | null;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const stopSchema = new Schema<RideStop>(
  {
    address: { type: String, required: true, trim: true, maxlength: 200 },
    location: { type: pointSchema, required: true },
  },
  { _id: false },
);

const handshakeSchema = new Schema<Handshake>(
  {
    code: { type: String, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    usedAt: { type: Date, default: null },
  },
  { _id: false },
);

const rideSchema = new Schema<RideRecord>(
  {
    code: { type: String, required: true, unique: true },
    handover: {
      start: handshakeSchema,
      finish: handshakeSchema,
    },
    rider: { type: Schema.Types.ObjectId, ref: "Rider", required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    city: { type: String, required: true },
    status: { type: String, enum: RIDE_STATUSES, default: "requested" },
    pickup: { type: stopSchema, required: true },
    dropoff: { type: stopSchema, required: true },
    distanceKm: { type: Number, required: true, min: 0 },
    durationMin: { type: Number, required: true, min: 0 },
    route: {
      // [longitude, latitude] pairs, the order every mapping tool expects.
      coordinates: { type: [[Number]], default: undefined },
      source: { type: String, default: undefined },
    },
    fare: {
      base: { type: Number, required: true },
      distance: { type: Number, required: true },
      time: { type: Number, required: true },
      bookingFee: { type: Number, required: true },
      total: { type: Number, required: true },
      commission: { type: Number, required: true },
      driverEarnings: { type: Number, required: true },
      currency: { type: String, required: true, default: "TND" },
      flat: { type: Boolean, default: undefined },
    },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    requestedAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: [...CANCELLED_BY, null], default: null },
    cancellationReason: { type: String, trim: true, maxlength: 300, default: null },
    cancellationFee: { type: Number, min: 0, default: null },
    riderRating: { type: Number, min: 1, max: 5, default: null },
    dispatch: {
      round: { type: Number, default: 0, min: 0 },
      candidates: { type: [Schema.Types.ObjectId], ref: "Driver", default: undefined },
      declinedBy: { type: [Schema.Types.ObjectId], ref: "Driver", default: undefined },
      offeredAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
    },
    isDemo: { type: Boolean, default: undefined },
  },
  { timestamps: true },
);

rideSchema.index({ status: 1, requestedAt: -1 });
rideSchema.index({ requestedAt: -1 });
rideSchema.index({ completedAt: -1 });
rideSchema.index({ rider: 1, status: 1 });
// Serves "which rides am I being offered": status + candidate + expiry.
rideSchema.index({ status: 1, "dispatch.candidates": 1, "dispatch.expiresAt": 1 });

export const Ride: Model<RideRecord> =
  (models.Ride as Model<RideRecord> | undefined) ?? model<RideRecord>("Ride", rideSchema);
