import { Schema, model, models, type Model, type Types } from "mongoose";

import { RIDER_STATUSES, type RiderStatus } from "../../domain/ride";

export interface RiderRecord {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  email?: string | null;
  status: RiderStatus;
  blockedReason?: string | null;
  rating: { average: number; count: number };
  stats: { completedRides: number };
  lastRideAt?: Date | null;
  /** Bumped to sign every device out (blocking, support action). */
  tokenVersion: number;
  lastLoginAt?: Date | null;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const riderSchema = new Schema<RiderRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, maxlength: 160, default: null },
    status: { type: String, enum: RIDER_STATUSES, default: "active", index: true },
    blockedReason: { type: String, trim: true, maxlength: 500, default: null },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    stats: {
      completedRides: { type: Number, default: 0, min: 0 },
    },
    lastRideAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 1, min: 1 },
    lastLoginAt: { type: Date, default: null },
    isDemo: { type: Boolean, default: undefined },
  },
  { timestamps: true },
);

riderSchema.index({ createdAt: -1 });

export const Rider: Model<RiderRecord> =
  (models.Rider as Model<RiderRecord> | undefined) ?? model<RiderRecord>("Rider", riderSchema);
