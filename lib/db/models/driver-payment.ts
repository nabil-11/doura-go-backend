import { Schema, model, models, type Model, type Types } from "mongoose";

import { PAYMENT_CHANNELS, type PaymentChannel } from "../../domain/pricing";

/**
 * A commission settlement: money a driver handed over, or a correction the
 * team made. Each row keeps the balance before and after, so the driver's
 * account can be read back line by line rather than trusted as a single
 * running total.
 */
export interface DriverPaymentRecord {
  _id: Types.ObjectId;
  driver: Types.ObjectId;
  amount: number;
  currency: string;
  channel: PaymentChannel;
  /** Receipt or transfer reference, when there is one. */
  reference?: string | null;
  note?: string | null;
  dueBefore: number;
  dueAfter: number;
  recordedBy?: { id: Types.ObjectId; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

const driverPaymentSchema = new Schema<DriverPaymentRecord>(
  {
    driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    amount: { type: Number, required: true, min: 0, max: 100_000 },
    currency: { type: String, required: true, default: "TND" },
    channel: { type: String, enum: PAYMENT_CHANNELS, required: true },
    reference: { type: String, trim: true, maxlength: 60, default: null },
    note: { type: String, trim: true, maxlength: 300, default: null },
    dueBefore: { type: Number, required: true, min: 0 },
    dueAfter: { type: Number, required: true, min: 0 },
    recordedBy: {
      id: { type: Schema.Types.ObjectId, ref: "Admin" },
      name: { type: String },
      _id: false,
    },
  },
  { timestamps: true },
);

driverPaymentSchema.index({ driver: 1, createdAt: -1 });

export const DriverPayment: Model<DriverPaymentRecord> =
  (models.DriverPayment as Model<DriverPaymentRecord> | undefined) ??
  model<DriverPaymentRecord>("DriverPayment", driverPaymentSchema);
