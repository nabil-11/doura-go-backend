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

export interface RideRecord {
  _id: Types.ObjectId;
  /** Short human-friendly reference, e.g. "DG-7F3K2Q" */
  code: string;
  rider: Types.ObjectId;
  driver?: Types.ObjectId | null;
  city: string;
  status: RideStatus;
  pickup: RideStop;
  dropoff: RideStop;
  distanceKm: number;
  durationMin: number;
  fare: {
    base: number;
    distance: number;
    time: number;
    bookingFee: number;
    total: number;
    commission: number;
    driverEarnings: number;
    currency: string;
  };
  paymentMethod: PaymentMethod;
  requestedAt: Date;
  acceptedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledBy?: CancelledBy | null;
  cancellationReason?: string | null;
  riderRating?: number | null;
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

const rideSchema = new Schema<RideRecord>(
  {
    code: { type: String, required: true, unique: true },
    rider: { type: Schema.Types.ObjectId, ref: "Rider", required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    city: { type: String, required: true },
    status: { type: String, enum: RIDE_STATUSES, default: "requested" },
    pickup: { type: stopSchema, required: true },
    dropoff: { type: stopSchema, required: true },
    distanceKm: { type: Number, required: true, min: 0 },
    durationMin: { type: Number, required: true, min: 0 },
    fare: {
      base: { type: Number, required: true },
      distance: { type: Number, required: true },
      time: { type: Number, required: true },
      bookingFee: { type: Number, required: true },
      total: { type: Number, required: true },
      commission: { type: Number, required: true },
      driverEarnings: { type: Number, required: true },
      currency: { type: String, required: true, default: "TND" },
    },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    requestedAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: [...CANCELLED_BY, null], default: null },
    cancellationReason: { type: String, trim: true, maxlength: 300, default: null },
    riderRating: { type: Number, min: 1, max: 5, default: null },
    isDemo: { type: Boolean, default: undefined },
  },
  { timestamps: true },
);

rideSchema.index({ status: 1, requestedAt: -1 });
rideSchema.index({ requestedAt: -1 });
rideSchema.index({ completedAt: -1 });

export const Ride: Model<RideRecord> =
  (models.Ride as Model<RideRecord> | undefined) ?? model<RideRecord>("Ride", rideSchema);
