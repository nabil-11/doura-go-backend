import "server-only";

import { compare, hash } from "bcryptjs";
import { isValidObjectId } from "mongoose";

import type { CurrentAdmin } from "@/lib/auth/dal";
import type { AdminRole } from "@/lib/auth/roles";
import { connectToDatabase } from "@/lib/db/connect";
import { Admin, type AdminRecord } from "@/lib/db/models/admin";

import { logActivity } from "./activity";
import type { ServiceResult } from "./drivers";

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

// Compared against when the email is unknown, so the response time doesn't
// reveal which accounts exist.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(crypto.randomUUID()));

export type AuthenticatedAdmin = Pick<AdminRecord, "role" | "sessionVersion"> & { id: string };

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<ServiceResult<AuthenticatedAdmin>> {
  await connectToDatabase();
  const admin = await Admin.findOne({ email }).select("+passwordHash").lean<AdminRecord>();

  if (!admin) {
    await compare(password, await getDummyHash());
    return { ok: false, error: "invalidCredentials" };
  }

  const now = new Date();
  if (admin.lockedUntil && admin.lockedUntil > now) return { ok: false, error: "rateLimited" };

  const valid = await compare(password, admin.passwordHash);
  if (!valid) {
    const failures = (admin.failedLoginCount ?? 0) + 1;
    const locked = failures >= MAX_FAILED_LOGINS;
    await Admin.updateOne(
      { _id: admin._id },
      {
        $set: {
          failedLoginCount: locked ? 0 : failures,
          lockedUntil: locked ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
        },
      },
    );
    return { ok: false, error: locked ? "rateLimited" : "invalidCredentials" };
  }

  if (!admin.isActive) return { ok: false, error: "accountDisabled" };

  await Admin.updateOne(
    { _id: admin._id },
    { $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } },
  );
  return {
    ok: true,
    data: { id: String(admin._id), role: admin.role, sessionVersion: admin.sessionVersion ?? 0 },
  };
}

export type AdminListItem = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export async function listAdmins(): Promise<AdminListItem[]> {
  await connectToDatabase();
  const admins = await Admin.find().sort({ createdAt: 1 }).lean<AdminRecord[]>();
  return admins.map((admin) => ({
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt ?? null,
    createdAt: admin.createdAt,
  }));
}

export async function createAdmin(
  input: { name: string; email: string; role: AdminRole; password: string },
  actor: CurrentAdmin,
): Promise<ServiceResult<{ id: string }>> {
  await connectToDatabase();
  if (await Admin.exists({ email: input.email })) return { ok: false, fieldErrors: { email: "emailTaken" } };

  const admin = await Admin.create({
    name: input.name,
    email: input.email,
    role: input.role,
    passwordHash: await hashPassword(input.password),
  });
  await logActivity({ action: "admin.created", actor, subject: { type: "admin", id: admin._id, label: input.name } });
  return { ok: true, data: { id: String(admin._id) } };
}

/** Refuses changes that would leave nobody able to manage the team. */
async function wouldRemoveLastSuperAdmin(target: AdminRecord) {
  if (target.role !== "super_admin" || !target.isActive) return false;
  const others = await Admin.countDocuments({ _id: { $ne: target._id }, role: "super_admin", isActive: true });
  return others === 0;
}

export async function changeAdminRole(id: string, role: AdminRole, actor: CurrentAdmin): Promise<ServiceResult> {
  if (!isValidObjectId(id)) return { ok: false, error: "notFound" };
  if (id === actor.id) return { ok: false, error: "cannotEditSelf" };
  await connectToDatabase();

  const target = await Admin.findById(id).lean<AdminRecord>();
  if (!target) return { ok: false, error: "notFound" };
  if (target.role === role) return { ok: true, data: undefined };
  if (role !== "super_admin" && (await wouldRemoveLastSuperAdmin(target))) {
    return { ok: false, error: "lastSuperAdmin" };
  }

  // A new role means new permissions: sign the person out everywhere.
  await Admin.updateOne({ _id: id }, { $set: { role }, $inc: { sessionVersion: 1 } });
  await logActivity({
    action: "admin.role_changed",
    actor,
    subject: { type: "admin", id, label: target.name },
    message: role,
  });
  return { ok: true, data: undefined };
}

export async function setAdminActive(id: string, active: boolean, actor: CurrentAdmin): Promise<ServiceResult> {
  if (!isValidObjectId(id)) return { ok: false, error: "notFound" };
  if (id === actor.id) return { ok: false, error: "cannotEditSelf" };
  await connectToDatabase();

  const target = await Admin.findById(id).lean<AdminRecord>();
  if (!target) return { ok: false, error: "notFound" };
  if (!active && (await wouldRemoveLastSuperAdmin(target))) return { ok: false, error: "lastSuperAdmin" };

  await Admin.updateOne(
    { _id: id },
    active
      ? { $set: { isActive: true, failedLoginCount: 0, lockedUntil: null } }
      : { $set: { isActive: false }, $inc: { sessionVersion: 1 } },
  );
  await logActivity({
    action: active ? "admin.enabled" : "admin.disabled",
    actor,
    subject: { type: "admin", id, label: target.name },
  });
  return { ok: true, data: undefined };
}

export async function updateOwnProfile(actor: CurrentAdmin, name: string) {
  await connectToDatabase();
  await Admin.updateOne({ _id: actor.id }, { $set: { name } });
}

/** Returns the new session version so the caller can re-issue its own session. */
export async function changeOwnPassword(
  actor: CurrentAdmin,
  currentPassword: string,
  newPassword: string,
): Promise<ServiceResult<{ sessionVersion: number }>> {
  await connectToDatabase();
  const admin = await Admin.findById(actor.id).select("+passwordHash").lean<AdminRecord>();
  if (!admin) return { ok: false, error: "unauthorized" };
  if (!(await compare(currentPassword, admin.passwordHash))) {
    return { ok: false, fieldErrors: { currentPassword: "wrongPassword" } };
  }

  const updated = await Admin.findByIdAndUpdate(
    actor.id,
    { $set: { passwordHash: await hashPassword(newPassword) }, $inc: { sessionVersion: 1 } },
    { returnDocument: "after" },
  ).lean<AdminRecord>();

  await logActivity({
    action: "admin.password_changed",
    actor,
    subject: { type: "admin", id: actor.id, label: actor.name },
  });
  return { ok: true, data: { sessionVersion: updated?.sessionVersion ?? admin.sessionVersion + 1 } };
}
