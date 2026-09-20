import { Schema, model, models, type Model, type Types } from "mongoose";

import { MOBILE_AUDIENCES, type MobileAudience } from "../../auth/audience";

/**
 * Long-lived credential for a mobile device. Rotated on every refresh: the old
 * token is revoked and a new one issued in the same family. Presenting a token
 * that is already revoked means it was stolen (or replayed), and the whole
 * family is dropped — so a thief and the real device can't both keep going.
 *
 * Revoked rows are kept until their original expiry, which is what makes that
 * detection possible; Mongo removes them afterwards.
 */
export interface RefreshTokenRecord {
  _id: Types.ObjectId;
  subject: Types.ObjectId;
  audience: MobileAudience;
  tokenHash: string;
  /** All tokens rotated from one sign-in share a family id. */
  family: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  device?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenRecord>(
  {
    subject: { type: Schema.Types.ObjectId, required: true, index: true },
    audience: { type: String, enum: MOBILE_AUDIENCES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    device: { type: String, maxlength: 200, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<RefreshTokenRecord> =
  (models.RefreshToken as Model<RefreshTokenRecord> | undefined) ??
  model<RefreshTokenRecord>("RefreshToken", refreshTokenSchema);
