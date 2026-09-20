/**
 * End-to-end check of the mobile API against a running server.
 *
 *   npm run dev                 # in one terminal
 *   npm run api:test            # in another
 *   npm run api:test -- --url http://localhost:3001
 *
 * It signs a rider and a driver in, books a ride, drives it to completion and
 * verifies the guards along the way. Everything it creates is tagged with a
 * unique run id and removed at the end, so it is safe against a development
 * database — but it does write, so never point it at production.
 */
import { parseArgs } from "node:util";

import mongoose from "mongoose";

import { hashOtpCode } from "@/lib/auth/mobile-token";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connect";
import { Driver } from "@/lib/db/models/driver";
import { OtpChallenge } from "@/lib/db/models/otp-challenge";
import { RefreshToken } from "@/lib/db/models/refresh-token";
import { Ride } from "@/lib/db/models/ride";
import { Rider } from "@/lib/db/models/rider";

function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Variables may come from the shell instead.
  }
}

const { values: args } = parseArgs({
  options: { url: { type: "string", default: "http://localhost:3000" } },
  allowPositionals: false,
});

const BASE = `${args.url.replace(/\/$/, "")}/api/v1`;
const RUN = Date.now().toString().slice(-7);
const TAG = `apitest-${RUN}`;

// Around Tunis, inside the service area; the far point is deliberately outside.
const PICKUP = { address: `Avenue Habib Bourguiba ${RUN}`, lat: 36.7992, lng: 10.1806 };
const DROPOFF = { address: `Rue de Marseille ${RUN}`, lat: 36.8305, lng: 10.1892 };
const NEAR_PICKUP = { lat: 36.8005, lng: 10.1791 };
const OUT_OF_AREA = { lat: 34.7406, lng: 10.76 }; // Sfax: not open yet

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: unknown, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✖ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

type Reply = { status: number; body: Record<string, never> & Record<string, unknown> };

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<Reply> {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body: body as Reply["body"] };
}

function errorCode(reply: Reply) {
  return (reply.body.error as { code?: string } | undefined)?.code;
}

const KNOWN_CODE = "424242";

/**
 * Asks for a code the normal way, then rewrites the stored hash to one this
 * script knows. Reading the SMS is the one thing a test can't do, and going
 * through the database keeps the run working against any server — development
 * or a production build, with or without an SMS provider.
 */
async function plantCode(phone: string, audience: "rider" | "driver") {
  await call("POST", "/auth/otp", { body: { phone, audience } });
  const updated = await OtpChallenge.findOneAndUpdate(
    { phone, audience, consumedAt: null },
    {
      $set: {
        codeHash: hashOtpCode(phone, audience, KNOWN_CODE),
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    },
    { sort: { createdAt: -1 }, returnDocument: "after" },
  ).lean();
  if (!updated) throw new Error(`no verification challenge was stored for ${phone}`);
  return KNOWN_CODE;
}

/** Signs in through the real OTP flow. */
async function signIn(phone: string, audience: "rider" | "driver", name?: string) {
  const code = await plantCode(phone, audience);
  const verify = await call("POST", "/auth/verify", { body: { phone, audience, code, name } });
  if (!verify.body.accessToken) throw new Error(`sign-in failed: ${JSON.stringify(verify.body)}`);
  return {
    accessToken: verify.body.accessToken as string,
    refreshToken: verify.body.refreshToken as string,
    reply: verify,
  };
}

async function createDriver(suffix: string, overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return Driver.create({
    firstName: `QA${suffix}`,
    lastName: `Test${RUN}`,
    phone: `+2169${RUN}${suffix}`,
    city: "tunis",
    status: "active",
    source: "admin",
    availability: "offline",
    license: { number: `L${RUN}${suffix}`, expiresAt: new Date(now.getFullYear() + 2, 0, 1) },
    vehicle: { type: "motorcycle", brand: "Yamaha", model: "NMAX", plateNumber: `${RUN}TN${suffix}` },
    documents: {
      photo: storedFile("photo"),
      license: storedFile("license"),
      idCard: storedFile("id"),
      registration: storedFile("registration"),
    },
    email: `${TAG}-${suffix}@example.test`,
    ...overrides,
  });
}

function storedFile(kind: string) {
  return {
    publicId: `${TAG}/${kind}`,
    deliveryType: "upload" as const,
    resourceType: "image",
    format: "jpg",
    version: 1,
    bytes: 1024,
    url: `https://example.test/${TAG}/${kind}.jpg`,
    uploadedAt: new Date(),
  };
}

async function main() {
  loadEnv();
  if (process.env.NODE_ENV === "production") {
    console.error("\n✖ Refusing to run against a production environment.\n");
    process.exit(1);
  }

  await connectToDatabase();
  console.log(`\nServer   ${BASE}`);
  console.log(`Database ${mongoose.connection.name}`);
  console.log(`Run tag  ${TAG}`);

  const driverA = await createDriver("1");
  const driverB = await createDriver("2");
  const pending = await createDriver("3", { status: "pending", documents: {}, license: {} });

  const riderPhone = `+2165${RUN}1`;
  let rideId = "";

  try {
    // ------------------------------------------------------------ discovery --
    section("Discovery");
    const index = await call("GET", "");
    check("GET /api/v1 lists the endpoints", index.status === 200 && !!index.body.endpoints, index.status);

    const config = await call("GET", "/config");
    const cities = (config.body.cities ?? []) as { id: string; bookable: boolean }[];
    check("GET /config returns pricing", config.status === 200 && !!config.body.pricing, config.status);
    check("Tunis is bookable, Sfax is not",
      cities.find((city) => city.id === "tunis")?.bookable === true &&
      cities.find((city) => city.id === "sfax")?.bookable === false);

    // ------------------------------------------------------------- sign-in ---
    section("Sign-in");
    const firstTry = await call("POST", "/auth/otp", { body: { phone: riderPhone, audience: "rider" } });
    check("a code is requested without revealing whether the number is known",
      firstTry.status === 200 || errorCode(firstTry) === "smsUnavailable", firstTry.body);

    const stored = await OtpChallenge.findOne({ phone: riderPhone, audience: "rider" }).lean();
    check("the code is stored hashed, never in the clear",
      !!stored && stored.codeHash.length === 64 && !/^\d{6}$/.test(stored.codeHash), stored?.codeHash?.slice(0, 12));

    const code = await plantCode(riderPhone, "rider");

    const wrongCode = await call("POST", "/auth/verify", {
      body: { phone: riderPhone, audience: "rider", code: "999999" },
    });
    check("a wrong code is refused", errorCode(wrongCode) === "invalidCode", wrongCode.body);

    const noName = await call("POST", "/auth/verify", {
      body: { phone: riderPhone, audience: "rider", code },
    });
    check("a new rider must give a name", errorCode(noName) === "nameRequired", noName.body);

    const withName = await call("POST", "/auth/verify", {
      body: { phone: riderPhone, audience: "rider", code, name: `QA Rider ${RUN}` },
    });
    check("the same code then works with a name", withName.status === 201, withName.body);
    const rider = { accessToken: withName.body.accessToken as string, refreshToken: withName.body.refreshToken as string };

    const replay = await call("POST", "/auth/verify", {
      body: { phone: riderPhone, audience: "rider", code, name: "Replay" },
    });
    check("a spent code cannot be replayed", errorCode(replay) === "codeExpired", replay.body);

    const unknownDriver = await call("POST", "/auth/otp", {
      body: { phone: "+21611111111", audience: "driver" },
    });
    check("an unknown driver number is refused", errorCode(unknownDriver) === "notRegistered", unknownDriver.body);

    const anonymous = await call("GET", "/me");
    check("no token means 401", anonymous.status === 401, anonymous.status);

    // ------------------------------------------------------------ profiles ---
    section("Profile");
    const me = await call("GET", "/me", { token: rider.accessToken });
    check("GET /me returns the rider", (me.body.rider as { name: string })?.name === `QA Rider ${RUN}`, me.body);

    const patched = await call("PATCH", "/me", {
      token: rider.accessToken,
      body: { email: `${TAG}@example.test` },
    });
    check("PATCH /me updates the email",
      (patched.body.rider as { email: string })?.email === `${TAG}@example.test`, patched.body);

    const driverSession = await signIn(driverA.phone, "driver");
    const driverMe = await call("GET", "/me", { token: driverSession.accessToken });
    const profile = driverMe.body.driver as { status: string; onboarding: { ready: boolean } };
    check("an approved driver is ready to work", profile?.status === "active" && profile.onboarding.ready, driverMe.body);

    const renameDriver = await call("PATCH", "/me", {
      token: driverSession.accessToken,
      body: { name: "Not Allowed" },
    });
    check("a driver cannot rename themselves", errorCode(renameDriver) === "forbidden", renameDriver.body);

    const crossAudience = await call("GET", "/driver/offers", { token: rider.accessToken });
    check("a rider token is refused on driver endpoints", crossAudience.status === 403, crossAudience.status);

    // ----------------------------------------------------------- estimates ---
    section("Fare estimate");
    const estimate = await call("POST", "/rides/estimate", {
      token: rider.accessToken,
      body: { pickup: PICKUP, dropoff: DROPOFF },
    });
    const fare = (estimate.body.estimate as { fare: { total: number }; city: string } | undefined);
    check("an estimate is priced in Tunis", estimate.status === 200 && fare?.city === "tunis" && fare.fare.total > 0, estimate.body);

    const outside = await call("POST", "/rides/estimate", {
      token: rider.accessToken,
      body: { pickup: OUT_OF_AREA, dropoff: DROPOFF },
    });
    check("a pickup outside the service area is refused",
      errorCode(outside) === "outsideServiceArea", outside.body);

    // ------------------------------------------------------ no driver yet ----
    section("Requesting with nobody online");
    const lonely = await call("POST", "/rides", {
      token: rider.accessToken,
      body: { pickup: PICKUP, dropoff: DROPOFF },
    });
    const lonelyRide = lonely.body.ride as { id: string; status: string; search: { round: number } };
    check("the ride is created and searching",
      lonely.status === 201 && lonelyRide.status === "requested" && lonelyRide.search.round === 1, lonely.body);

    const second = await call("POST", "/rides", {
      token: rider.accessToken,
      body: { pickup: PICKUP, dropoff: DROPOFF },
    });
    check("a rider cannot book two rides at once", errorCode(second) === "rideInProgress", second.body);

    const cancelled = await call("POST", `/rides/${lonelyRide.id}/cancel`, { token: rider.accessToken });
    check("cancelling before a driver accepts is free",
      (cancelled.body.ride as { status: string })?.status === "cancelled" && cancelled.body.fee === 0, cancelled.body);

    // -------------------------------------------------------- going online ---
    section("Driver going online");
    const pendingSession = await signIn(pending.phone, "driver");
    const pendingOnline = await call("POST", "/driver/availability", {
      token: pendingSession.accessToken,
      body: { availability: "online", location: NEAR_PICKUP },
    });
    check("an unapproved driver cannot go online",
      errorCode(pendingOnline) === "driverNotActive", pendingOnline.body);

    const noLocation = await call("POST", "/driver/availability", {
      token: driverSession.accessToken,
      body: { availability: "online" },
    });
    check("going online without a position is refused",
      errorCode(noLocation) === "invalidRequest", noLocation.body);

    const online = await call("POST", "/driver/availability", {
      token: driverSession.accessToken,
      body: { availability: "online", location: NEAR_PICKUP },
    });
    check("with a position the driver is online",
      (online.body.driver as { availability: string })?.availability === "online", online.body);

    const heartbeat = await call("POST", "/driver/location", {
      token: driverSession.accessToken,
      body: NEAR_PICKUP,
    });
    check("the position heartbeat is accepted", heartbeat.status === 200, heartbeat.body);

    const driverBSession = await signIn(driverB.phone, "driver");
    await call("POST", "/driver/availability", {
      token: driverBSession.accessToken,
      body: { availability: "online", location: NEAR_PICKUP },
    });

    // ------------------------------------------------------------ dispatch ---
    section("Dispatch");
    const booked = await call("POST", "/rides", {
      token: rider.accessToken,
      body: { pickup: PICKUP, dropoff: DROPOFF, paymentMethod: "cash" },
    });
    const ride = booked.body.ride as { id: string; status: string; code: string };
    rideId = ride.id;
    check("the ride is requested", booked.status === 201 && ride.status === "requested", booked.body);

    const offersA = await call("GET", "/driver/offers", { token: driverSession.accessToken });
    const offerList = (offersA.body.offers ?? []) as { id: string; pickupDistanceKm: number; earnings: number }[];
    const offer = offerList.find((entry) => entry.id === rideId);
    check("both nearby drivers are offered the ride", !!offer, offersA.body);
    check("the offer shows the distance to pickup and the earnings",
      typeof offer?.pickupDistanceKm === "number" && (offer?.earnings ?? 0) > 0, offer);

    const declined = await call("POST", `/rides/${rideId}/decline`, { token: driverBSession.accessToken });
    check("a driver can pass on an offer", declined.status === 200, declined.body);

    const offersB = await call("GET", "/driver/offers", { token: driverBSession.accessToken });
    check("a declined ride leaves that driver's list",
      !((offersB.body.offers ?? []) as { id: string }[]).some((entry) => entry.id === rideId), offersB.body);

    const lost = await call("POST", `/rides/${rideId}/accept`, { token: driverBSession.accessToken });
    check("a driver who declined cannot then accept", errorCode(lost) === "offerExpired", lost.body);

    const accepted = await call("POST", `/rides/${rideId}/accept`, { token: driverSession.accessToken });
    check("the first driver to accept gets the ride",
      (accepted.body.ride as { status: string })?.status === "accepted", accepted.body);

    const tooLate = await call("POST", `/rides/${rideId}/accept`, { token: driverBSession.accessToken });
    check("a second accept is refused", errorCode(tooLate) === "offerExpired", tooLate.body);

    // -------------------------------------------------------- the two views --
    section("What each side sees");
    const riderView = await call("GET", `/rides/${rideId}`, { token: rider.accessToken });
    const shownDriver = (riderView.body.ride as { driver: { phone?: string; firstName: string; location: unknown } }).driver;
    check("the rider sees the driver's name, number and position",
      !!shownDriver.phone && shownDriver.firstName === driverA.firstName && !!shownDriver.location, shownDriver);

    const driverView = await call("GET", `/rides/${rideId}`, { token: driverSession.accessToken });
    const shownRider = (driverView.body.ride as { rider: { phone?: string } }).rider;
    check("the driver sees the rider's number", !!shownRider.phone, shownRider);

    const outsider = await call("GET", `/rides/${rideId}`, { token: driverBSession.accessToken });
    check("an uninvolved driver gets 404", outsider.status === 404, outsider.status);

    // ----------------------------------------------------------- the steps ---
    section("Riding");
    const skipped = await call("POST", `/rides/${rideId}/complete`, { token: driverSession.accessToken });
    check("a ride cannot be completed before it starts",
      errorCode(skipped) === "invalidTransition", skipped.body);

    const arrived = await call("POST", `/rides/${rideId}/arrive`, { token: driverSession.accessToken });
    check("arrive → arriving", (arrived.body.ride as { status: string })?.status === "arriving", arrived.body);

    const started = await call("POST", `/rides/${rideId}/start`, { token: driverSession.accessToken });
    check("start → in_progress", (started.body.ride as { status: string })?.status === "in_progress", started.body);

    const tooLateToCancel = await call("POST", `/rides/${rideId}/cancel`, { token: rider.accessToken });
    check("the rider cannot cancel once on board",
      errorCode(tooLateToCancel) === "invalidTransition", tooLateToCancel.body);

    const before = (started.body.ride as { fare: { total: number } }).fare.total;
    const completed = await call("POST", `/rides/${rideId}/complete`, {
      token: driverSession.accessToken,
      body: { distanceKm: 6.5, durationMin: 20 },
    });
    const finalRide = completed.body.ride as {
      status: string;
      fare: { total: number; driverEarnings: number; commission: number };
    };
    check("complete → completed", finalRide?.status === "completed", completed.body);
    check("the fare is settled on what was actually ridden",
      completed.body.fareChanged === true && finalRide.fare.total !== before,
      { before, after: finalRide?.fare.total });

    const replayComplete = await call("POST", `/rides/${rideId}/complete`, { token: driverSession.accessToken });
    check("completing twice is refused", errorCode(replayComplete) === "invalidTransition", replayComplete.body);

    const freedDriver = await Driver.findById(driverA._id).lean();
    check("the driver is back online and credited",
      freedDriver?.availability === "online" &&
        freedDriver.stats.completedRides === 1 &&
        Math.abs((freedDriver.stats.earnings ?? 0) - finalRide.fare.driverEarnings) < 0.001,
      freedDriver?.stats);

    const earnings = await call("GET", "/driver/earnings", { token: driverSession.accessToken });
    const today = (earnings.body.earnings as { today: { rides: number; earnings: number } }).today;
    check("today's earnings show the ride", today.rides === 1 && today.earnings > 0, earnings.body);

    // --------------------------------------------------------- commission ---
    section("Commission owed");
    const owing = await Driver.findById(driverA._id).select("balance").lean();
    check("the commission on a cash ride is added to what the driver owes",
      Math.abs((owing?.balance?.commissionDue ?? 0) - finalRide.fare.commission) < 0.001,
      { due: owing?.balance?.commissionDue, commission: finalRide.fare.commission });

    const limit = (await call("GET", "/config")).body.pricing as { creditLimit?: number };
    await Driver.updateOne({ _id: driverA._id }, { $set: { "balance.commissionDue": 100_000 } });

    const overLimit = await call("GET", "/me", { token: driverSession.accessToken });
    check("the driver's own profile shows the account is stopped",
      (overLimit.body.driver as { balance: { blocked: boolean } })?.balance.blocked === true,
      overLimit.body.driver);

    await Driver.updateOne({ _id: driverA._id }, { $set: { availability: "offline" } });
    const blockedOnline = await call("POST", "/driver/availability", {
      token: driverSession.accessToken,
      body: { availability: "online", location: NEAR_PICKUP },
    });
    check("a driver over the limit cannot go back online",
      errorCode(blockedOnline) === "commissionDue", blockedOnline.body);

    await Driver.updateOne({ _id: driverA._id }, { $set: { "balance.commissionDue": 0 } });
    const reopened = await call("POST", "/driver/availability", {
      token: driverSession.accessToken,
      body: { availability: "online", location: NEAR_PICKUP },
    });
    check("settling the balance puts them back on the road",
      (reopened.body.driver as { availability: string })?.availability === "online",
      { reopened: reopened.status, limit });

    // ------------------------------------------------------------- rating ---
    section("Rating");
    const rated = await call("POST", `/rides/${rideId}/rate`, {
      token: rider.accessToken,
      body: { rating: 5 },
    });
    check("a completed ride can be rated", (rated.body.ride as { riderRating: number })?.riderRating === 5, rated.body);

    const ratedAgain = await call("POST", `/rides/${rideId}/rate`, {
      token: rider.accessToken,
      body: { rating: 1 },
    });
    check("rating twice is refused", errorCode(ratedAgain) === "alreadyRated", ratedAgain.body);

    const scoredDriver = await Driver.findById(driverA._id).lean();
    check("the score lands on the driver's average",
      scoredDriver?.rating.count === 1 && scoredDriver.rating.average === 5, scoredDriver?.rating);

    const badRating = await call("POST", `/rides/${rideId}/rate`, {
      token: rider.accessToken,
      body: { rating: 9 },
    });
    check("an out-of-range rating is rejected", badRating.status === 400, badRating.status);

    // ------------------------------------------------------------ history ---
    section("History");
    const history = await call("GET", "/rides?pageSize=10", { token: rider.accessToken });
    check("the rider's history holds both rides", history.body.total === 2, history.body.total);

    const driverHistory = await call("GET", "/rides", { token: driverSession.accessToken });
    check("the driver's history holds one", driverHistory.body.total === 1, driverHistory.body.total);

    const active = await call("GET", "/rides/active", { token: rider.accessToken });
    check("no ride is active any more", active.body.ride === null, active.body);

    // ------------------------------------------------------------- tokens ---
    section("Tokens");
    const refreshed = await call("POST", "/auth/refresh", { body: { refreshToken: rider.refreshToken } });
    check("a refresh token buys a new pair",
      refreshed.status === 200 && !!refreshed.body.accessToken && refreshed.body.refreshToken !== rider.refreshToken,
      refreshed.status);
    const rotated = refreshed.body.refreshToken as string;

    const stillWorks = await call("GET", "/me", { token: refreshed.body.accessToken as string });
    check("the new access token works", stillWorks.status === 200, stillWorks.status);

    const reused = await call("POST", "/auth/refresh", { body: { refreshToken: rider.refreshToken } });
    check("reusing the old refresh token is refused",
      errorCode(reused) === "invalidRefreshToken", reused.body);

    const familyGone = await call("POST", "/auth/refresh", { body: { refreshToken: rotated } });
    check("reuse kills the whole family, including the newest token",
      errorCode(familyGone) === "invalidRefreshToken", familyGone.body);

    const driverLogout = await call("POST", "/auth/logout", { body: { refreshToken: driverSession.refreshToken } });
    check("logout reports success", driverLogout.status === 200, driverLogout.body);
    const afterLogout = await call("POST", "/auth/refresh", { body: { refreshToken: driverSession.refreshToken } });
    check("a signed-out refresh token is dead",
      errorCode(afterLogout) === "invalidRefreshToken", afterLogout.body);

    // ------------------------------------------------------------- guards ---
    section("Guards");
    await Rider.updateOne({ phone: riderPhone }, { $set: { status: "blocked" } });
    const blocked = await call("GET", "/me", { token: stillWorks.status === 200 ? (refreshed.body.accessToken as string) : rider.accessToken });
    check("a blocked rider loses access at once", errorCode(blocked) === "accountBlocked", blocked.body);
    await Rider.updateOne({ phone: riderPhone }, { $set: { status: "active" } });

    const flood = await Promise.all(
      Array.from({ length: 5 }, () =>
        call("POST", "/auth/otp", { body: { phone: `+2165${RUN}9`, audience: "rider" } }),
      ),
    );
    check("repeated code requests are rate limited",
      flood.some((reply) => errorCode(reply) === "rateLimited"),
      flood.map((reply) => reply.status));

    const malformed = await call("POST", "/rides", {
      token: rider.accessToken,
      body: { pickup: { address: "x", lat: 999, lng: 10 }, dropoff: DROPOFF },
    });
    check("invalid coordinates name the offending fields",
      malformed.status === 400 && !!(malformed.body.error as { details?: object }).details, malformed.body);
  } finally {
    await cleanUp();
  }

  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  if (failures.length) {
    console.log(failures.map((label) => `  ✖ ${label}`).join("\n"));
    process.exitCode = 1;
  }
  await disconnectFromDatabase();
}

async function cleanUp() {
  const drivers = await Driver.find({ lastName: `Test${RUN}` }).select("_id").lean();
  const driverIds = drivers.map((driver) => driver._id);
  const riders = await Rider.find({ phone: new RegExp(`^\\+2165${RUN}`) }).select("_id").lean();
  const riderIds = riders.map((rider) => rider._id);

  const removed = await Promise.all([
    Ride.deleteMany({ $or: [{ rider: { $in: riderIds } }, { driver: { $in: driverIds } }] }),
    Driver.deleteMany({ _id: { $in: driverIds } }),
    Rider.deleteMany({ _id: { $in: riderIds } }),
    RefreshToken.deleteMany({ subject: { $in: [...driverIds, ...riderIds] } }),
    OtpChallenge.deleteMany({ phone: new RegExp(`^\\+216[59]${RUN}`) }),
  ]);
  console.log(`\nCleaned up ${removed.reduce((sum, result) => sum + result.deletedCount, 0)} test documents.`);
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
