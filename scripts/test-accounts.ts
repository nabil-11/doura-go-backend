/**
 * Demo accounts that sign in with a fixed code and no SMS.
 *
 *   npm run test:accounts            create (or refresh) them and print the codes
 *   npm run test:accounts -- --remove   delete them
 *
 * Use them to work on the apps without a phone in your hand, and to give Apple
 * and Google a working account at review time — a reviewer in California cannot
 * receive a Tunisian text message.
 *
 * The numbers are in a range Tunisia does not assign to subscribers, so they can
 * never belong to a real person. Their codes go in TEST_PHONE_NUMBERS; nothing
 * works until that variable is set, so an environment without it has no back
 * door at all.
 */
import { randomInt } from "node:crypto";
import { parseArgs } from "node:util";

import { Types } from "mongoose";

import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connect";
import { Driver } from "@/lib/db/models/driver";
import { OtpChallenge } from "@/lib/db/models/otp-challenge";
import { RefreshToken } from "@/lib/db/models/refresh-token";
import { Rider } from "@/lib/db/models/rider";

function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Variables may come from the shell instead.
  }
}

const RIDER_PHONE = "+21610000001";
const DRIVER_PHONE = "+21610000002";

const { values: args } = parseArgs({
  options: { remove: { type: "boolean", default: false } },
  allowPositionals: false,
});

function storedFile(kind: string) {
  return {
    publicId: `doura-go/demo/${kind}`,
    deliveryType: "upload" as const,
    resourceType: "image",
    format: "jpg",
    version: 1,
    bytes: 1024,
    // Placeholder: the demo driver has no real paperwork on file, which is why
    // this account should never be approved for actual work.
    url: `https://res.cloudinary.com/demo/image/upload/sample.jpg`,
    uploadedAt: new Date(),
  };
}

async function remove() {
  const [rider, driver] = await Promise.all([
    Rider.findOne({ phone: RIDER_PHONE }).select("_id").lean(),
    Driver.findOne({ phone: DRIVER_PHONE }).select("_id").lean(),
  ]);
  const ids = [rider?._id, driver?._id].filter((id): id is Types.ObjectId => Boolean(id));

  await Promise.all([
    Rider.deleteOne({ phone: RIDER_PHONE }),
    Driver.deleteOne({ phone: DRIVER_PHONE }),
    OtpChallenge.deleteMany({ phone: { $in: [RIDER_PHONE, DRIVER_PHONE] } }),
    RefreshToken.deleteMany({ subject: { $in: ids } }),
  ]);

  console.log("\n✔ Demo accounts removed. Clear TEST_PHONE_NUMBERS from .env too.\n");
}

async function create() {
  const now = new Date();

  const rider = await Rider.findOneAndUpdate(
    { phone: RIDER_PHONE },
    { $set: { name: "Demo Rider", status: "active" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();

  // Everything the approval checklist wants, so the account can actually work.
  const driver = await Driver.findOneAndUpdate(
    { phone: DRIVER_PHONE },
    {
      $set: {
        firstName: "Demo",
        lastName: "Driver",
        city: "tunis",
        status: "active",
        source: "admin",
        availability: "offline",
        approvedAt: now,
        license: { number: "DEMO-LICENCE", expiresAt: new Date(now.getFullYear() + 3, 0, 1) },
        vehicle: {
          type: "motorcycle",
          brand: "Yamaha",
          model: "NMAX",
          year: now.getFullYear() - 1,
          color: "Jaune",
          plateNumber: "DEMO 1",
        },
        documents: {
          photo: storedFile("photo"),
          license: storedFile("license"),
          idCard: storedFile("id-card"),
          registration: storedFile("registration"),
        },
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();

  const riderCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const driverCode = String(randomInt(0, 1_000_000)).padStart(6, "0");

  console.log(`
✔ Demo accounts ready

  Rider   ${RIDER_PHONE}   code ${riderCode}   (${rider?.name})
  Driver  ${DRIVER_PHONE}   code ${driverCode}   (${driver?.firstName} ${driver?.lastName})

Add this line to .env and restart the server:

TEST_PHONE_NUMBERS=${RIDER_PHONE}:${riderCode},${DRIVER_PHONE}:${driverCode}

In the apps, type the number without the country code: 10 000 001 / 10 000 002.

Keep these out of a public repository, and re-run this command to roll the
codes whenever you want. Remove the variable to close the door entirely.
`);
}

async function main() {
  loadEnv();
  await connectToDatabase();
  if (args.remove) await remove();
  else await create();
  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
