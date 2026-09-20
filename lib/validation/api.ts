// Request schemas for the mobile API.
//
// Unlike the form schemas next door, these messages are read by whoever is
// building the app, not by a rider — so they are plain English hints and they
// come back in `error.details`, keyed by field.

import { z } from "zod";

import { MOBILE_AUDIENCES } from "@/lib/auth/audience";
import { ENABLED_PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/ride";

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const coordinates = z.object({ lat: latitude, lng: longitude });

export const stop = z.object({
  address: z.string().trim().min(3, "at least 3 characters").max(200),
  lat: latitude,
  lng: longitude,
});

// ---------------------------------------------------------------- sign-in ---

const audience = z.enum(MOBILE_AUDIENCES);
const phone = z.string().trim().min(8, "too short for a phone number").max(20);

export const otpRequestSchema = z.object({ phone, audience });

export const otpVerifySchema = z.object({
  phone,
  audience,
  code: z.string().trim().regex(/^\d{6}$/, "six digits"),
  /** Required the first time a rider signs in; ignored for drivers. */
  name: z.string().trim().min(2).max(80).optional(),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.email().trim().toLowerCase().max(160).nullish(),
  })
  .refine((value) => value.name !== undefined || value.email !== undefined, "nothing to update");

// ------------------------------------------------------------------ rides ---

export const estimateSchema = z.object({ pickup: coordinates, dropoff: coordinates });

export const requestRideSchema = z.object({
  pickup: stop,
  dropoff: stop,
  paymentMethod: z
    .enum(ENABLED_PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], "only cash is available today")
    .default("cash"),
});

export const cancelSchema = z
  .object({ reason: z.string().trim().max(300).optional() })
  .optional()
  .default({});

export const rateSchema = z.object({ rating: z.int().min(1).max(5) });

/** What the driver app measured, used to settle the fare. Both are optional. */
export const completeSchema = z
  .object({
    distanceKm: z.number().min(0).max(500).optional(),
    durationMin: z.number().min(0).max(1440).optional(),
  })
  .optional()
  .default({});

// ----------------------------------------------------------------- driver ---

export const availabilitySchema = z.object({
  availability: z.enum(["online", "offline"]),
  location: coordinates.optional(),
});

export const locationSchema = coordinates;

// ------------------------------------------------------------------ query ---

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
