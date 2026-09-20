import "server-only";

import { Types, isValidObjectId } from "mongoose";

import type { CurrentAdmin } from "@/lib/auth/dal";
import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { DriverPayment, type DriverPaymentRecord } from "@/lib/db/models/driver-payment";
import { EMPTY_BALANCE, isOverCreditLimit, readBalance, type DriverBalance, type PaymentChannel } from "@/lib/domain/pricing";
import { DEFAULT_CURRENCY } from "@/lib/i18n/format";

import { logActivity } from "./activity";
import type { ServiceResult } from "./drivers";
import { getPricingValues } from "./pricing";

/**
 * The commission a driver owes on cash rides, and how it gets settled.
 *
 * The debt is the reason a driver comes into the office: they ride, they take
 * cash from riders, and Doura Go's share builds up until they pay it. Past the
 * limit set on the pricing page, the account stops taking rides — so this
 * number decides who is on the road.
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
  const creditLimit = limit ?? (await getPricingValues()).commissionCreditLimit;
  const balance = balanceOf(driver);
  return {
    ...balance,
    limit: creditLimit,
    blocked: isOverCreditLimit(balance.commissionDue, creditLimit),
    remaining: creditLimit > 0 ? Math.max(0, round3(creditLimit - balance.commissionDue)) : 0,
    currency: DEFAULT_CURRENCY,
  };
}

/** Adds a completed ride's commission to what the driver owes. */
export async function accrueCommission(driverId: Types.ObjectId, commission: number) {
  if (commission <= 0) return;
  await Driver.updateOne({ _id: driverId }, { $inc: { "balance.commissionDue": round3(commission) } });
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

  const dueBefore = round3(driver.balance?.commissionDue ?? 0);
  if (input.expectedDue !== undefined && Math.abs(input.expectedDue - dueBefore) > 0.0005) {
    return { ok: false, error: "balanceChanged" };
  }
  if (dueBefore <= 0) return { ok: false, error: "nothingDue" };

  const applied = round3(Math.min(input.amount, dueBefore));
  const dueAfter = round3(dueBefore - applied);
  const now = new Date();

  const updated = await Driver.findOneAndUpdate(
    { _id: driverId, "balance.commissionDue": dueBefore },
    {
      $set: { "balance.commissionDue": dueAfter, "balance.lastPaymentAt": now },
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
  const creditLimit = limit ?? (await getPricingValues()).commissionCreditLimit;
  if (creditLimit <= 0) return 0;
  return Driver.countDocuments({ status: "active", "balance.commissionDue": { $gte: creditLimit } });
}

export { EMPTY_BALANCE };
