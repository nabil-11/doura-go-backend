"use server";

import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createApplication } from "@/lib/services/drivers";
import { formValues, toFieldErrors, type ActionState } from "@/lib/validation/common";
import { APPLICATION_FIELDS, applicationSchema } from "@/lib/validation/driver";

import { revalidateBackoffice, unexpected } from "./shared";

/** Minimum time a human needs to fill the form. Faster submissions are bots. */
const MIN_FILL_MS = 2500;

export async function submitApplicationAction(
  _previous: ActionState<{ name: string }>,
  formData: FormData,
): Promise<ActionState<{ name: string }>> {
  // Spam traps: a hidden field only bots fill, and a minimum fill time.
  // Bots get a fake success so they don't learn what gave them away.
  const honeypot = formData.get("company");
  const elapsed = Number(formData.get("elapsed"));
  if ((typeof honeypot === "string" && honeypot.trim() !== "") || !(elapsed >= MIN_FILL_MS)) {
    return { status: "success", data: { name: "" } };
  }

  const ip = await getClientIp();
  if (!rateLimit(`apply:${ip}`, 5, 60 * 60_000).ok) return { status: "error", error: "rateLimited" };

  const parsed = applicationSchema.safeParse(formValues(formData, APPLICATION_FIELDS));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const result = await createApplication(parsed.data);
    if (!result.ok) return { status: "error", error: result.error, fieldErrors: result.fieldErrors };
  } catch (error) {
    return unexpected(error);
  }

  revalidateBackoffice();
  return { status: "success", data: { name: parsed.data.firstName } };
}
