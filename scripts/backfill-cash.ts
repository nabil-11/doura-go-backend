/**
 * Fills in `balance.cashCollected` for drivers who earned it before the field
 * existed.
 *
 * The limit used to be measured against the commission owed; it is now
 * measured against the cash the driver is holding. Rides completed before that
 * change only ever incremented the commission, so those drivers read as
 * holding nothing while still owing — which is both wrong and, on the balance
 * card, obviously wrong.
 *
 * The cash is not derived from the commission (the rate may have moved, and
 * short rides are priced flat). It is summed from the rides themselves: every
 * completed cash ride since the driver last settled.
 *
 *   npm run db:backfill-cash          what it would change
 *   npm run db:backfill-cash -- --write   actually change it
 */
import { parseArgs } from "node:util";

import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { Ride } from "@/lib/db/models/ride";

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Variables may come from the shell instead.
  }

  const { values } = parseArgs({ options: { write: { type: "boolean", default: false } } });
  const write = values.write === true;

  await connectToDatabase();
  const drivers = await Driver.find({}).select("firstName lastName balance").lean<DriverRecord[]>();

  let changed = 0;
  for (const driver of drivers) {
    const balance = driver.balance ?? {};
    const already = round3(balance.cashCollected ?? 0);
    // Only rides the driver has not settled for. Never settled means all of them.
    const since = balance.lastPaymentAt ?? null;
    const rides = await Ride.find({
      driver: driver._id,
      status: "completed",
      paymentMethod: "cash",
      ...(since ? { completedAt: { $gt: since } } : {}),
    })
      .select("fare.total")
      .lean<{ fare: { total: number } }[]>();

    const cash = round3(rides.reduce((sum, ride) => sum + (ride.fare?.total ?? 0), 0));
    if (Math.abs(cash - already) < 0.0005) continue;

    const name = `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() || String(driver._id);
    console.log(
      `  ${name.padEnd(24)} cash ${already.toFixed(3).padStart(9)} → ${cash.toFixed(3).padStart(9)}` +
        `   (${rides.length} unsettled cash ride${rides.length === 1 ? "" : "s"}, owes ${round3(balance.commissionDue ?? 0).toFixed(3)})`,
    );
    changed += 1;
    if (write) {
      await Driver.updateOne({ _id: driver._id }, { $set: { "balance.cashCollected": cash } });
    }
  }

  console.log(
    changed === 0
      ? "\nEvery driver's cash already matches their rides."
      : `\n${changed} driver${changed === 1 ? "" : "s"} ${write ? "updated" : "would change"}.` +
          (write ? "" : "  Re-run with --write to apply."),
  );
  await disconnectFromDatabase();
}

main();
