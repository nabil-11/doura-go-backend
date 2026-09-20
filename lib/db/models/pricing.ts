import { Schema, model, models, type Model, type Types } from "mongoose";

import { DEFAULT_PRICING, type PricingValues } from "../../domain/pricing";

export interface PricingRecord extends PricingValues {
  _id: Types.ObjectId;
  /** Singleton key — one pricing document per service area in the future. */
  key: string;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const money = { type: Number, required: true, min: 0, max: 10_000 };

const pricingSchema = new Schema<PricingRecord>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    currency: { type: String, required: true, default: DEFAULT_PRICING.currency },
    baseFare: money,
    perKm: money,
    perMinute: money,
    minimumFare: money,
    bookingFee: money,
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    commissionCreditLimit: { type: Number, required: true, min: 0, max: 10_000, default: DEFAULT_PRICING.commissionCreditLimit },
    cancellationFee: money,
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

export const Pricing: Model<PricingRecord> =
  (models.Pricing as Model<PricingRecord> | undefined) ?? model<PricingRecord>("Pricing", pricingSchema);
