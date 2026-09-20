import "server-only";

import { randomUUID } from "node:crypto";

import { Types } from "mongoose";

import { ApiError } from "@/lib/api/errors";
import type { MobileAudience } from "@/lib/auth/audience";
import { testCodeFor } from "@/lib/auth/test-numbers";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  ACCESS_TTL_SECONDS,
  constantTimeEqual,
  hashOtpCode,
  hashSecretValue,
  newOtpCode,
  newRefreshToken,
  signAccessToken,
} from "@/lib/auth/mobile-token";
import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import { OtpChallenge, type OtpChallengeRecord } from "@/lib/db/models/otp-challenge";
import { RefreshToken, type RefreshTokenRecord } from "@/lib/db/models/refresh-token";
import { Rider, type RiderRecord } from "@/lib/db/models/rider";
import { E164_REGEX, normalizePhone } from "@/lib/domain/driver";
import { sendSms, smsConfigured, verificationMessage } from "@/lib/notifications/sms";

const isProduction = process.env.NODE_ENV === "production";

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export function toE164(input: string) {
  const phone = normalizePhone(input);
  if (!E164_REGEX.test(phone)) throw new ApiError("invalidRequest", { phone: "expected an E.164 phone number" });
  return phone;
}

// ---------------------------------------------------------------- sign-in ---

export type OtpRequestResult = {
  expiresAt: Date;
  /** Only outside production, and only while no SMS provider is configured. */
  debugCode?: string;
};

export async function requestOtp(input: {
  phone: string;
  audience: MobileAudience;
  ip?: string;
}): Promise<OtpRequestResult> {
  const phone = toE164(input.phone);
  await connectToDatabase();

  // Drivers are onboarded through the website and approved by the team, so an
  // unknown number is a dead end — better to say so than to send nothing and
  // let them wait. Rider numbers are never confirmed or denied here.
  if (input.audience === "driver") {
    const exists = await Driver.exists({ phone });
    if (!exists) throw new ApiError("notRegistered");
  }

  // A test number always gets the same code, and nothing is sent anywhere.
  const fixedCode = testCodeFor(phone);
  const code = fixedCode ?? newOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  // One live challenge per number and app: requesting a new code retires the old.
  await OtpChallenge.deleteMany({ phone, audience: input.audience, consumedAt: null });
  await OtpChallenge.create({
    phone,
    audience: input.audience,
    codeHash: hashOtpCode(phone, input.audience, code),
    expiresAt,
    requestIp: input.ip ?? null,
  });

  // Whoever set the number up already knows its code, so it is neither sent
  // nor echoed back — the flow is then identical in every environment.
  if (fixedCode) return { expiresAt };

  const sent = await sendSms(phone, verificationMessage(code));
  if (!sent.delivered && isProduction) throw new ApiError("smsUnavailable");

  return { expiresAt, ...(sent.delivered || isProduction ? {} : { debugCode: code }) };
}

export type SignInResult = {
  tokens: Tokens;
  audience: MobileAudience;
  accountId: string;
  /** Bumped to sign every device out — a session has to carry it to be revocable. */
  tokenVersion: number;
  isNewAccount: boolean;
};

export async function verifyOtp(input: {
  phone: string;
  audience: MobileAudience;
  code: string;
  name?: string;
  device?: string | null;
}): Promise<SignInResult> {
  const phone = toE164(input.phone);
  await connectToDatabase();

  const challenge = await OtpChallenge.findOne({ phone, audience: input.audience, consumedAt: null })
    .sort({ createdAt: -1 })
    .lean<OtpChallengeRecord>();

  if (!challenge) throw new ApiError("codeExpired");
  if (challenge.expiresAt.getTime() <= Date.now()) throw new ApiError("codeExpired");
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError("tooManyAttempts");

  if (!constantTimeEqual(challenge.codeHash, hashOtpCode(phone, input.audience, input.code))) {
    await OtpChallenge.updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
    throw new ApiError("invalidCode");
  }

  // The code is right from here on. Anything that fails below is a missing
  // detail, not a bad code, so the challenge stays usable for the retry.
  const account =
    input.audience === "rider"
      ? await signInRider(phone, input.name)
      : await signInDriver(phone);

  await OtpChallenge.updateOne({ _id: challenge._id }, { $set: { consumedAt: new Date() } });

  const tokens = await issueTokens({
    subject: account.id,
    audience: input.audience,
    tokenVersion: account.tokenVersion,
    device: input.device ?? null,
  });

  return {
    tokens,
    audience: input.audience,
    accountId: account.id,
    tokenVersion: account.tokenVersion,
    isNewAccount: account.isNew,
  };
}

async function signInRider(phone: string, name: string | undefined) {
  const existing = await Rider.findOneAndUpdate(
    { phone },
    { $set: { lastLoginAt: new Date() } },
    { returnDocument: "after" },
  ).lean<RiderRecord>();

  if (existing) {
    if (existing.status === "blocked") throw new ApiError("accountBlocked");
    return { id: String(existing._id), tokenVersion: existing.tokenVersion ?? 1, isNew: false };
  }

  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 2) throw new ApiError("nameRequired");

  const created = await Rider.create({ name: trimmed, phone, lastLoginAt: new Date() });
  return { id: String(created._id), tokenVersion: created.tokenVersion ?? 1, isNew: true };
}

async function signInDriver(phone: string) {
  const driver = await Driver.findOneAndUpdate(
    { phone },
    { $set: { lastLoginAt: new Date() } },
    { returnDocument: "after" },
  ).lean<DriverRecord>();

  if (!driver) throw new ApiError("notRegistered");
  return { id: String(driver._id), tokenVersion: driver.tokenVersion ?? 1, isNew: false };
}

// ----------------------------------------------------------------- tokens ---

async function issueTokens(input: {
  subject: string;
  audience: MobileAudience;
  tokenVersion: number;
  device: string | null;
  family?: string;
}): Promise<Tokens> {
  const refreshToken = newRefreshToken();
  await RefreshToken.create({
    subject: new Types.ObjectId(input.subject),
    audience: input.audience,
    tokenHash: hashSecretValue(refreshToken),
    family: input.family ?? randomUUID(),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    device: input.device?.slice(0, 200) ?? null,
  });

  const accessToken = await signAccessToken({
    id: input.subject,
    audience: input.audience,
    ver: input.tokenVersion,
  });

  return { accessToken, refreshToken, tokenType: "Bearer", expiresIn: ACCESS_TTL_SECONDS };
}

/**
 * Swaps a refresh token for a fresh pair. The old token is revoked in the same
 * step; presenting it again means someone copied it, and the whole family is
 * dropped so both the thief and the real device have to sign in again.
 */
export async function refreshSession(input: { refreshToken: string; device?: string | null }): Promise<Tokens> {
  await connectToDatabase();
  const tokenHash = hashSecretValue(input.refreshToken);
  const record = await RefreshToken.findOne({ tokenHash }).lean<RefreshTokenRecord>();

  if (!record || record.expiresAt.getTime() <= Date.now()) throw new ApiError("invalidRefreshToken");

  if (record.revokedAt) {
    await RefreshToken.updateMany(
      { family: record.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    console.warn(`[auth] refresh token reuse detected for ${record.audience} ${String(record.subject)}`);
    throw new ApiError("invalidRefreshToken");
  }

  const tokenVersion = await currentTokenVersion(record.audience, String(record.subject));
  if (tokenVersion === null) throw new ApiError("invalidRefreshToken");

  await RefreshToken.updateOne({ _id: record._id }, { $set: { revokedAt: new Date() } });

  return issueTokens({
    subject: String(record.subject),
    audience: record.audience,
    tokenVersion,
    device: input.device ?? record.device ?? null,
    family: record.family,
  });
}

async function currentTokenVersion(audience: MobileAudience, id: string) {
  if (audience === "rider") {
    const rider = await Rider.findById(id).select("tokenVersion status").lean<RiderRecord>();
    if (!rider || rider.status === "blocked") return null;
    return rider.tokenVersion ?? 1;
  }
  const driver = await Driver.findById(id).select("tokenVersion").lean<DriverRecord>();
  return driver ? (driver.tokenVersion ?? 1) : null;
}

/** Signs one device out. Unknown tokens are ignored — logging out never fails. */
export async function revokeRefreshToken(refreshToken: string) {
  await connectToDatabase();
  await RefreshToken.updateOne(
    { tokenHash: hashSecretValue(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

/** Signs every device out: used when an account is blocked or suspended. */
export async function revokeAllSessions(audience: MobileAudience, id: string) {
  await connectToDatabase();
  await Promise.all([
    audience === "rider"
      ? Rider.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } })
      : Driver.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } }),
    RefreshToken.updateMany({ subject: new Types.ObjectId(id), revokedAt: null }, { $set: { revokedAt: new Date() } }),
  ]);
}

export { smsConfigured };
