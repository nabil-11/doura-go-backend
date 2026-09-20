/** Turns the rider-code requirement on or off without a deploy. */
import { parseArgs } from "node:util";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connect";
import { Pricing } from "@/lib/db/models/pricing";

async function main() {
  try { process.loadEnvFile(".env"); } catch { /* shell may supply it */ }
  const { values } = parseArgs({ options: { on: { type: "boolean" }, off: { type: "boolean" } } });
  await connectToDatabase();

  if (!values.on && !values.off) {
    const current = await Pricing.findOne({ key: "default" }).lean<{ requireHandover?: boolean }>();
    console.log("rider code required: " + (current?.requireHandover ?? true));
  } else {
    const next = values.on === true;
    await Pricing.updateOne({ key: "default" }, { $set: { requireHandover: next } }, { upsert: false });
    console.log("rider code required: " + next);
  }
  await disconnectFromDatabase();
}
main();
