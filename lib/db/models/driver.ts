import { Schema, model, models, type Model, type Types } from "mongoose";

import {
  DRIVER_AVAILABILITY,
  DRIVER_SOURCES,
  DRIVER_STATUSES,
  VEHICLE_TYPES,
  type DocumentKind,
  type DriverAvailability,
  type DriverSource,
  type DriverStatus,
  type VehicleType,
} from "../../domain/driver";
import type { DriverBalance } from "../../domain/pricing";
import { pointSchema, storedFileSchema, type GeoPoint, type StoredFile } from "./shared";

export interface DriverRecord {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: Date | null;
  city: string;
  address?: string | null;
  nationalId?: string | null;
  status: DriverStatus;
  source: DriverSource;
  availability: DriverAvailability;
  license: { number?: string | null; expiresAt?: Date | null };
  vehicle: {
    type: VehicleType;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    color?: string | null;
    plateNumber?: string | null;
  };
  documents: Partial<Record<DocumentKind, StoredFile>>;
  rating: { average: number; count: number };
  stats: { completedRides: number; earnings: number };
  /** Commission owed to Doura Go on cash rides, and what has been settled. */
  balance: DriverBalance;
  /** Last known position, reported by the driver app. */
  location?: GeoPoint | null;
  lastSeenAt?: Date | null;
  /** Bumped to sign every device out (suspension, support action). */
  tokenVersion: number;
  lastLoginAt?: Date | null;
  review?: {
    by?: Types.ObjectId | null;
    at?: Date | null;
    reason?: string | null;
  } | null;
  approvedAt?: Date | null;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const driverSchema = new Schema<DriverRecord>(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, maxlength: 160, default: null },
    dateOfBirth: { type: Date, default: null },
    city: { type: String, required: true, index: true },
    address: { type: String, trim: true, maxlength: 200, default: null },
    nationalId: { type: String, trim: true, maxlength: 20, default: null },
    status: { type: String, enum: DRIVER_STATUSES, default: "pending", index: true },
    source: { type: String, enum: DRIVER_SOURCES, default: "admin" },
    availability: { type: String, enum: DRIVER_AVAILABILITY, default: "offline", index: true },
    license: {
      number: { type: String, trim: true, maxlength: 40, default: null },
      expiresAt: { type: Date, default: null },
    },
    vehicle: {
      type: { type: String, enum: VEHICLE_TYPES, default: "motorcycle" },
      brand: { type: String, trim: true, maxlength: 40, default: null },
      model: { type: String, trim: true, maxlength: 40, default: null },
      year: { type: Number, min: 1980, max: 2100, default: null },
      color: { type: String, trim: true, maxlength: 30, default: null },
      plateNumber: { type: String, trim: true, uppercase: true, maxlength: 20, default: null },
    },
    documents: {
      photo: { type: storedFileSchema, default: undefined },
      license: { type: storedFileSchema, default: undefined },
      idCard: { type: storedFileSchema, default: undefined },
      registration: { type: storedFileSchema, default: undefined },
      insurance: { type: storedFileSchema, default: undefined },
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    stats: {
      completedRides: { type: Number, default: 0, min: 0 },
      earnings: { type: Number, default: 0, min: 0 },
    },
    balance: {
      commissionDue: { type: Number, default: 0, min: 0 },
      paidTotal: { type: Number, default: 0, min: 0 },
      lastPaymentAt: { type: Date, default: null },
    },
    // No default: a missing point keeps the document out of the 2dsphere index.
    location: { type: pointSchema, default: undefined },
    lastSeenAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 1, min: 1 },
    lastLoginAt: { type: Date, default: null },
    review: {
      by: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
      at: { type: Date, default: null },
      reason: { type: String, trim: true, maxlength: 500, default: null },
    },
    approvedAt: { type: Date, default: null },
    isDemo: { type: Boolean, default: undefined },
  },
  { timestamps: true },
);

driverSchema.index({ location: "2dsphere" });
driverSchema.index({ status: 1, createdAt: -1 });
driverSchema.index(
  { "vehicle.plateNumber": 1 },
  { unique: true, partialFilterExpression: { "vehicle.plateNumber": { $type: "string" } } },
);

export const Driver: Model<DriverRecord> =
  (models.Driver as Model<DriverRecord> | undefined) ?? model<DriverRecord>("Driver", driverSchema);
