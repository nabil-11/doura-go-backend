"use server";

import { authorize } from "@/lib/auth/dal";
import { createSession } from "@/lib/auth/session";
import {
  changeAdminRole,
  changeOwnPassword,
  createAdmin,
  setAdminActive,
  updateOwnProfile,
} from "@/lib/services/admins";
import { updatePricing } from "@/lib/services/pricing";
import { setRiderBlocked } from "@/lib/services/riders";
import {
  PRICING_FIELDS,
  passwordChangeSchema,
  pricingSchema,
  profileSchema,
  roleSchema,
  teamMemberSchema,
} from "@/lib/validation/admin";
import { formValues, toFieldErrors, type ActionState } from "@/lib/validation/common";

import { revalidateBackoffice, unexpected } from "./shared";

// ---------------------------------------------------------------------------
// Riders
// ---------------------------------------------------------------------------

export async function setRiderBlockedAction(riderId: string, blocked: boolean): Promise<ActionState> {
  const auth = await authorize("riders:manage");
  if (!auth.ok) return { status: "error", error: auth.error };
  try {
    const result = await setRiderBlocked(riderId, blocked, auth.admin);
    if (!result.ok) return { status: "error", error: result.error };
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export async function updatePricingAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("pricing:manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = pricingSchema.safeParse(formValues(formData, PRICING_FIELDS));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    await updatePricing(parsed.data, auth.admin);
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function createAdminAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("team:manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = teamMemberSchema.safeParse(formValues(formData, ["name", "email", "role", "password"]));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const result = await createAdmin(parsed.data, auth.admin);
    if (!result.ok) return { status: "error", error: result.error, fieldErrors: result.fieldErrors };
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

export async function changeAdminRoleAction(adminId: string, role: string): Promise<ActionState> {
  const auth = await authorize("team:manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { status: "error", error: "generic" };

  try {
    const result = await changeAdminRole(adminId, parsed.data, auth.admin);
    if (!result.ok) return { status: "error", error: result.error };
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

export async function setAdminActiveAction(adminId: string, active: boolean): Promise<ActionState> {
  const auth = await authorize("team:manage");
  if (!auth.ok) return { status: "error", error: auth.error };
  try {
    const result = await setAdminActive(adminId, active, auth.admin);
    if (!result.ok) return { status: "error", error: result.error };
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

// ---------------------------------------------------------------------------
// Own account
// ---------------------------------------------------------------------------

export async function updateProfileAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("dashboard:view");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = profileSchema.safeParse(formValues(formData, ["name"]));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    await updateOwnProfile(auth.admin, parsed.data.name);
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

export async function changePasswordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("dashboard:view");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = passwordChangeSchema.safeParse(
    formValues(formData, ["currentPassword", "newPassword", "confirmPassword"]),
  );
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const result = await changeOwnPassword(auth.admin, parsed.data.currentPassword, parsed.data.newPassword);
    if (!result.ok) return { status: "error", error: result.error, fieldErrors: result.fieldErrors };
    // Other sessions are now invalid; keep this one alive with the new version.
    await createSession({ sub: auth.admin.id, role: auth.admin.role, ver: result.data.sessionVersion });
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}
