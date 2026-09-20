import "server-only";

import { Types, isValidObjectId } from "mongoose";

import type { CurrentAdmin } from "@/lib/auth/dal";
import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { DriverPayment, type DriverPaymentRecord } from "@/lib/db/models/driver-payment";
import { EMPTY_BALANCE, isOverCashLimit, readBalance, type DriverBalance, type PaymentChannel } from "@/lib/domain/pricing";
import { DEFAULT_CURRENCY } from "@/lib/i18n/format";

import { logActivity } from "./activity";
import type { ServiceResult } from "./drivers";
import { getPricingValues } from "./pricing";

/**
 * The cash a driver is carrying, the commission owed on it, and how it gets
 * settled.
 *
 * Riders pay in cash, so the whole fare stays in the driver's pocket and the
 * platform's money piles up there between visits to the office. The limit set
 * on the pricing page is on that cash — it is the exposure — while what the
 * driver hands over is the commission on it. Past the limit the account stops
 * taking rides, so these numbers decide who is on the road.
 */

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

type HasBalance = { balance?: Partial<DriverBalance> | null };

export function balanceOf(driver: HasBalance): DriverBalance {
  return readBalance(driver.balance);
}

export type BalanceState = DriverBalance & {
  limit: number;
  blocked: boolean;
  remaining: number;
  currency: string;
};

export async function balanceState(driver: HasBalance, limit?: number): Promise<BalanceState> {
  const cashLimit = limit ?? (await getPricingValues()).cashLimit;
  const balance = balanceOf(driver);
  return {
    ...balance,
    limit: cashLimit,
    // The limit watches the cash in the driver's pocket, not the commission
    // slice of it — see DriverBalance.
    blocked: isOverCashLimit(balance, cashLimit),
    remaining: cashLimit > 0 ? Math.max(0, round3(cashLimit - balance.cashCollected)) : 0,
    currency: DEFAULT_CURRENCY,
  };
}

/** Books a completed cash ride: the fare into the pocket, our share as debt. */
export async function accrueCashRide(driverId: Types.ObjectId, fare: number, commission: number) {
  if (fare <= 0 && commission <= 0) return;
  await Driver.updateOne(
    { _id: driverId },
    {
      $inc: {
        ...(fare > 0 ? { "balance.cashCollected": round3(fare) } : {}),
        ...(commission > 0 ? { "balance.commissionDue": round3(commission) } : {}),
      },
    },
  );
}

export type PaymentInput = {
  amount: number;
  channel: PaymentChannel;
  reference?: string | null;
  note?: string | null;
  /** The balance the operator was looking at, to catch a stale form. */
  expectedDue?: number;
};

export type RecordedPayment = { balance: BalanceState; applied: number };

/**
 * Records a settlement and lowers the debt.
 *
 * The write is conditional on the balance still being what the operator saw,
 * so two people settling the same driver at once can't both subtract from the
 * same total. Paying more than is owed simply clears it — the excess is not
 * carried as credit, which matches how the cash actually changes hands.
 */
export async function recordDriverPayment(
  driverId: string,
  input: PaymentInput,
  actor: CurrentAdmin,
): Promise<ServiceResult<RecordedPayment>> {
  if (!isValidObjectId(driverId)) return { ok: false, error: "notFound" };
  await connectToDatabase();

  const driver = await Driver.findById(driverId).select("balance firstName lastName").lean<DriverRecord>();
  if (!driver) return { ok: false, error: "notFound" };

  // Read twice over: rounded for arithmetic and for what the operator sees,
  // raw for the conditional write below.
  //
  // A balance built up by repeated $inc drifts — 17.450000000000003 — and the
  // write pins the balance to catch a concurrent settlement. Pinning it to the
  // *rounded* figure matches no document at all, so every settlement would
  // report a conflict that wasn't there and the account could never be
  // cleared. Round what people read; match on what is stored.
  const rawDue = driver.balance?.commissionDue ?? 0;
  const rawCash = driver.balance?.cashCollected ?? 0;
  const dueBefore = round3(rawDue);
  const cashBefore = round3(rawCash);
  if (input.expectedDue !== undefined && Math.abs(input.expectedDue - dueBefore) > 0.0005) {
    return { ok: false, error: "balanceChanged" };
  }
  if (dueBefore <= 0) return { ok: false, error: "nothingDue" };

  const applied = round3(Math.min(input.amount, dueBefore));
  const dueAfter = round3(dueBefore - applied);
  // Settling the debt clears the cycle the cash belongs to, so the pocket
  // empties with it — and a part payment empties it by the same fraction,
  // which keeps the two in step without depending on the commission rate.
  const cashAfter = dueBefore > 0 ? round3(cashBefore * (dueAfter / dueBefore)) : 0;
  const now = new Date();

  const updated = await Driver.findOneAndUpdate(
    // Both numbers are pinned, exactly as stored: a ride completing between
    // the read above and this write would otherwise have its cash silently
    // wiped. Nothing else may have moved them in between.
    { _id: driverId, "balance.commissionDue": rawDue, "balance.cashCollected": rawCash },
    {
      $set: {
        "balance.commissionDue": dueAfter,
        "balance.cashCollected": cashAfter,
        "balance.lastPaymentAt": now,
      },
      // A correction is bookkeeping, not money received, so it isn't counted.
      ...(input.channel === "adjustment" ? {} : { $inc: { "balance.paidTotal": applied } }),
    },
    { returnDocument: "after" },
  ).lean<DriverRecord>();

  if (!updated) return { ok: false, error: "balanceChanged" };

  await DriverPayment.create({
    driver: new Types.ObjectId(driverId),
    amount: applied,
    currency: DEFAULT_CURRENCY,
    channel: input.channel,
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
    dueBefore,
    dueAfter,
    recordedBy: { id: new Types.ObjectId(actor.id), name: actor.name },
  });

  await logActivity({
    action: "driver.payment_recorded",
    actor,
    subject: { type: "driver", id: driverId, label: `${driver.firstName} ${driver.lastName}`.trim() },
    message: `${applied.toFixed(3)} ${DEFAULT_CURRENCY}`,
  });

  return { ok: true, data: { balance: await balanceState(updated), applied } };
}

export type PaymentEntry = {
  id: string;
  amount: number;
  currency: string;
  channel: PaymentChannel;
  reference: string | null;
  note: string | null;
  dueAfter: number;
  recordedByName: string | null;
  createdAt: Date;
};

export async function listDriverPayments(driverId: string, limit = 10): Promise<PaymentEntry[]> {
  if (!isValidObjectId(driverId)) return [];
  await connectToDatabase();
  const rows = await DriverPayment.find({ driver: driverId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<DriverPaymentRecord[]>();

  return rows.map((row) => ({
    id: String(row._id),
    amount: row.amount,
    currency: row.currency ?? DEFAULT_CURRENCY,
    channel: row.channel,
    reference: row.reference ?? null,
    note: row.note ?? null,
    dueAfter: row.dueAfter,
    recordedByName: row.recordedBy?.name ?? null,
    createdAt: row.createdAt,
  }));
}

/** Drivers currently stopped by the limit — the queue for the office. */
export async function countDriversOverLimit(limit?: number) {
  await connectToDatabase();
  const cashLimit = limit ?? (await getPricingValues()).cashLimit;
  if (cashLimit <= 0) return 0;
  return Driver.countDocuments({
    status: "active",
    "balance.cashCollected": { $gte: cashLimit },
    "balance.commissionDue": { $gt: 0 },
  });
}

export { EMPTY_BALANCE };
