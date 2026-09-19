import { z } from "zod";

import { cityIds } from "@/lib/config/site";
import { DRIVER_ACTION_NAMES, VEHICLE_TYPES, ageFrom, type DriverAction } from "@/lib/domain/driver";

import {
  optionalDate,
  optionalEmail,
  optionalPlate,
  optionalText,
  optionalYear,
  phone,
  requiredText,
} from "./common";

const city = z.enum(cityIds, { error: "invalidChoice" });
const vehicleType = z.enum(VEHICLE_TYPES, { error: "invalidChoice" });

const dateOfBirth = optionalDate.refine((value) => !value || (ageFrom(value) ?? 0) >= 18, {
  error: "mustBeAdult",
});

/** Fields shared by the create and edit forms in the backoffice. */
export const DRIVER_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "dateOfBirth",
  "city",
  "address",
  "nationalId",
  "licenseNumber",
  "licenseExpiry",
  "vehicleType",
  "vehicleBrand",
  "vehicleModel",
  "vehicleYear",
  "vehicleColor",
  "plateNumber",
] as const;

export const driverSchema = z.object({
  firstName: requiredText(60, 2),
  lastName: requiredText(60, 2),
  phone,
  email: optionalEmail,
  dateOfBirth,
  city,
  address: optionalText(200),
  nationalId: optionalText(20),
  licenseNumber: optionalText(40),
  licenseExpiry: optionalDate,
  vehicleType,
  vehicleBrand: optionalText(40),
  vehicleModel: optionalText(40),
  vehicleYear: optionalYear,
  vehicleColor: optionalText(30),
  plateNumber: optionalPlate,
});

export type DriverInput = z.infer<typeof driverSchema>;

export const createDriverSchema = driverSchema.extend({
  initialStatus: z.enum(["pending", "active"], { error: "invalidChoice" }),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;

/** Public "become a driver" form. */
export const APPLICATION_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "city",
  "vehicleType",
  "vehicleBrand",
  "vehicleModel",
  "vehicleYear",
  "plateNumber",
  "licenseNumber",
  "consent",
] as const;

export const applicationSchema = z.object({
  firstName: requiredText(60, 2),
  lastName: requiredText(60, 2),
  phone,
  email: optionalEmail,
  city,
  vehicleType,
  vehicleBrand: requiredText(40),
  vehicleModel: optionalText(40),
  vehicleYear: optionalYear,
  plateNumber: optionalPlate,
  licenseNumber: optionalText(40),
  consent: z.literal("on", { error: "consentRequired" }),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const statusChangeSchema = z.object({
  action: z.enum(DRIVER_ACTION_NAMES as [DriverAction, ...DriverAction[]], { error: "invalidChoice" }),
  reason: optionalText(500),
});

export const noteSchema = z.object({
  note: requiredText(1000),
});
