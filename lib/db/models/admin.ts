import { Schema, model, models, type Model, type Types } from "mongoose";

import { ADMIN_ROLES, type AdminRole } from "../../auth/roles";

export interface AdminRecord {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  /** Bumped to invalidate every existing session of this admin. */
  sessionVersion: number;
  lastLoginAt?: Date | null;
  failedLoginCount: number;
  lockedUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLES, required: true, default: "support" },
    isActive: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Admin: Model<AdminRecord> =
  (models.Admin as Model<AdminRecord> | undefined) ?? model<AdminRecord>("Admin", adminSchema);
