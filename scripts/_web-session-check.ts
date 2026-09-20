/**
 * Temporary helper for checking the website's cookie sign-in by hand.
 * Mirrors `plantCode` in `scripts/api-smoke.ts`; delete after use.
 */
import { hashOtpCode } from "@/lib/auth/mobile-token";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connect";
import { OtpChallenge } from "@/lib/db/models/otp-challenge";
import { RefreshToken } from "@/lib/db/models/refresh-token";
import { Ride } from "@/lib/db/models/ride";
import { Rider } from "@/lib/db/models/rider";

try {
  process.loadEnvFile(".env");
} catch {
  // Variables may come from the shell instead.
}

const [, , command, phone, code = "424242"] = process.argv;

async function main() {
  await connectToDatabase();

  if (command === "plant") {
    const updated = await OtpChallenge.findOneAndUpdate(
      { phone, audience: "rider", consumedAt: null },
      {
        $set: {
          codeHash: hashOtpCode(phone, "rider", code),
          attempts: 0,
          expiresAt: new Date(Date.now() + 5 * 60_000),
        },
      },
      { sort: { createdAt: -1 }, returnDocument: "after" },
    ).lean();
    console.log(updated ? `planted ${code} for ${phone}` : `no challenge stored for ${phone}`);
  } else if (command === "promote") {
    // Moves the rider's live ride on without a driver app, purely to read back
    // the handover codes the rider's screen is supposed to show.
    const rider = await Rider.findOne({ phone }).lean<{ _id: unknown }>();
    const updated = rider
      ? await Ride.findOneAndUpdate(
          { rider: rider._id, status: "requested" },
          { $set: { status: code, acceptedAt: new Date() } },
          { returnDocument: "after" },
        ).lean<{ _id: unknown }>()
      : null;
    console.log(updated ? `ride ${String(updated._id)} is now ${code}` : "no requested ride found");
  } else if (command === "clean") {
    const rider = await Rider.findOne({ phone }).lean<{ _id: unknown }>();
    const rides = rider ? await Ride.deleteMany({ rider: rider._id }) : { deletedCount: 0 };
    const tokens = rider ? await RefreshToken.deleteMany({ subject: rider._id }) : { deletedCount: 0 };
    const challenges = await OtpChallenge.deleteMany({ phone });
    const riders = await Rider.deleteMany({ phone });
    console.log(
      `removed rider=${riders.deletedCount} rides=${rides.deletedCount} tokens=${tokens.deletedCount} challenges=${challenges.deletedCount}`,
    );
  } else {
    console.log("usage: plant <phone> [code] | clean <phone>");
  }

  await disconnectFromDatabase();
}

void main();
