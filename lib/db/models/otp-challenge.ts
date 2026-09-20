import { Schema, model, models, type Model, type Types } from "mongoose";

import { MOBILE_AUDIENCES, type MobileAudience } from "../../auth/audience";

/**
 * A one-time code sent by SMS. The code itself is never stored: only an HMAC
 * keyed with the app secret, which is not in the database — so a dump of this
 * collection reveals nothing, even though six digits are trivial to brute force.
 */
export interface OtpChallengeRecord {
  _id: Types.ObjectId;
  phone: string;
  audience: MobileAudience;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date | null;
  requestIp?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const otpChallengeSchema = new Schema<OtpChallengeRecord>(
  {
    phone: { type: String, required: true, index: true },
    audience: { type: String, enum: MOBILE_AUDIENCES, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    consumedAt: { type: Date, default: null },
    requestIp: { type: String, default: null },
  },
  { timestamps: true },
);

// Mongo removes expired challenges on its own — nothing to clean up by hand.
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallenge: Model<OtpChallengeRecord> =
  (models.OtpChallenge as Model<OtpChallengeRecord> | undefined) ??
  model<OtpChallengeRecord>("OtpChallenge", otpChallengeSchema);
