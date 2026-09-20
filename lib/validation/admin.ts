import { z } from "zod";

import { ADMIN_ROLES } from "@/lib/auth/roles";

import { money, password, requiredEmail, requiredText } from "./common";

export const loginSchema = z.object({
  email: requiredEmail,
  password: z.string({ error: "required" }).min(1, { error: "required" }).max(128, { error: "tooLong" }),
});

export const teamMemberSchema = z.object({
  name: requiredText(80, 2),
  email: requiredEmail,
  role: z.enum(ADMIN_ROLES, { error: "invalidChoice" }),
  password,
});

export const roleSchema = z.enum(ADMIN_ROLES, { error: "invalidChoice" });

export const profileSchema = z.object({
  name: requiredText(80, 2),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string({ error: "required" }).min(1, { error: "required" }),
    newPassword: password,
    confirmPassword: z.string({ error: "required" }).min(1, { error: "required" }),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    error: "passwordMismatch",
    path: ["confirmPassword"],
  });

export const PRICING_FIELDS = [
  "baseFare",
  "perKm",
  "perMinute",
  "minimumFare",
  "bookingFee",
  "commissionRate",
  "cancellationFee",
  "shortRideKm",
  "shortRideFare",
  "commissionCreditLimit",
] as const;

export const pricingSchema = z.object({
  baseFare: money(),
  perKm: money(),
  perMinute: money(),
  minimumFare: money(),
  bookingFee: money(),
  commissionRate: money(100),
  cancellationFee: money(),
  shortRideKm: money(50),
  shortRideFare: money(),
  commissionCreditLimit: money(10_000),
});
