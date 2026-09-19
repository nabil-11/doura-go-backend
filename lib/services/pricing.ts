import "server-only";

import { Types } from "mongoose";

import type { CurrentAdmin } from "@/lib/auth/dal";
import { connectToDatabase } from "@/lib/db/connect";
import { Admin } from "@/lib/db/models/admin";
import { Pricing, type PricingRecord } from "@/lib/db/models/pricing";
import { DEFAULT_PRICING, type PricingValues } from "@/lib/domain/pricing";

import { logActivity } from "./activity";

export type PricingState = {
  values: PricingValues;
  isDefault: boolean;
  updatedAt: Date | null;
  updatedByName: string | null;
};

function pick(record: PricingRecord): PricingValues {
  return {
    currency: record.currency,
    baseFare: record.baseFare,
    perKm: record.perKm,
    perMinute: record.perMinute,
    minimumFare: record.minimumFare,
    bookingFee: record.bookingFee,
    commissionRate: record.commissionRate,
    cancellationFee: record.cancellationFee,
  };
}

export async function getPricing(): Promise<PricingState> {
  await connectToDatabase();
  const record = await Pricing.findOne({ key: "default" }).lean<PricingRecord>();
  if (!record) return { values: DEFAULT_PRICING, isDefault: true, updatedAt: null, updatedByName: null };

  const updatedBy = record.updatedBy
    ? await Admin.findById(record.updatedBy).select("name").lean<{ name: string }>()
    : null;
  return {
    values: pick(record),
    isDefault: false,
    updatedAt: record.updatedAt,
    updatedByName: updatedBy?.name ?? null,
  };
}

export async function updatePricing(values: Omit<PricingValues, "currency">, actor: CurrentAdmin) {
  await connectToDatabase();
  await Pricing.findOneAndUpdate(
    { key: "default" },
    {
      $set: { ...values, updatedBy: new Types.ObjectId(actor.id) },
      $setOnInsert: { key: "default", currency: DEFAULT_PRICING.currency },
    },
    { upsert: true, runValidators: true },
  );
  await logActivity({ action: "pricing.updated", actor, subject: { type: "pricing", label: "pricing" } });
}
