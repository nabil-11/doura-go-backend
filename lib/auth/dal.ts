import "server-only";

import { isValidObjectId } from "mongoose";
import { cache } from "react";

import { connectToDatabase } from "@/lib/db/connect";
import { Admin } from "@/lib/db/models/admin";

import { can, type AdminRole, type Permission } from "./roles";
import { readSession } from "./session";

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
};

/**
 * The signed-in admin, verified against the database: the account must exist,
 * be active, and the session version must match (password changes and access
 * removal invalidate older sessions). Memoised per request.
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const session = await readSession();
  if (!session || !isValidObjectId(session.sub)) return null;

  await connectToDatabase();
  const admin = await Admin.findById(session.sub)
    .select("name email role isActive sessionVersion")
    .lean();

  if (!admin || !admin.isActive || admin.sessionVersion !== session.ver) return null;
  return { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role };
});

export type AuthorizationResult =
  | { ok: true; admin: CurrentAdmin }
  | { ok: false; error: "unauthorized" | "forbidden" };

/** For server actions and route handlers: checks the session and a permission, never redirects. */
export async function authorize(permission: Permission): Promise<AuthorizationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };
  if (!can(admin.role, permission)) return { ok: false, error: "forbidden" };
  return { ok: true, admin };
}
