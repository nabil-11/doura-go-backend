// Shared validation helpers. Error messages are dictionary codes, never
// sentences — the UI translates them (see `resolveMessage`).

import { z } from "zod";

import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { E164_REGEX, normalizePhone, normalizePlate } from "@/lib/domain/driver";

export type ValidationCode = keyof Dictionary["validation"];
export type ErrorCode = keyof Dictionary["errors"];
export type MessageCode = ValidationCode | ErrorCode;
export type FieldErrors = Partial<Record<string, MessageCode>>;

export type ActionState<TData = undefined> =
  | { status: "idle" }
  | { status: "success"; data?: TData }
  | { status: "error"; error?: ErrorCode; fieldErrors?: FieldErrors };

export const idleState = { status: "idle" } as const;

const VALIDATION_CODES = new Set<string>([
  "required",
  "tooShort",
  "tooLong",
  "invalidEmail",
  "invalidPhone",
  "invalidDate",
  "invalidNumber",
  "outOfRange",
  "invalidChoice",
  "mustBeAdult",
  "licenseExpired",
  "invalidYear",
  "invalidPlate",
  "fileTooLarge",
  "fileType",
  "passwordTooShort",
  "passwordWeak",
  "passwordMismatch",
  "consentRequired",
] satisfies ValidationCode[]);

/** Translate a message code with the dictionary. */
export function resolveMessage(
  dict: Pick<Dictionary, "validation" | "errors">,
  code: MessageCode | undefined,
): string | undefined {
  if (!code) return undefined;
  if (code in dict.validation) return dict.validation[code as ValidationCode];
  if (code in dict.errors) return dict.errors[code as ErrorCode];
  return dict.errors.generic;
}

/** First error per field, as dictionary codes. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "form";
    if (result[field]) continue;
    if (VALIDATION_CODES.has(issue.message)) {
      result[field] = issue.message as ValidationCode;
    } else if (issue.code === "too_small") {
      result[field] = "tooShort";
    } else if (issue.code === "too_big") {
      result[field] = "tooLong";
    } else if (issue.code === "invalid_type") {
      result[field] = "required";
    } else {
      result[field] = "invalidChoice";
    }
  }
  return result;
}

/** Read the given keys from FormData as trimmed-later strings (files are ignored). */
export function formValues<const K extends string>(formData: FormData, keys: readonly K[]) {
  const values = {} as Record<K, string | undefined>;
  for (const key of keys) {
    const value = formData.get(key);
    values[key] = typeof value === "string" ? value : undefined;
  }
  return values;
}

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const requiredText = (max: number, min = 1) =>
  z
    .string({ error: "required" })
    .trim()
    .min(1, { error: "required" })
    .min(min, { error: "tooShort" })
    .max(max, { error: "tooLong" });

export const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, { error: "tooLong" }).optional());

export const optionalEmail = z.preprocess(
  blankToUndefined,
  z.email({ error: "invalidEmail" }).trim().toLowerCase().max(160, { error: "tooLong" }).optional(),
);

export const requiredEmail = z
  .string({ error: "required" })
  .trim()
  .min(1, { error: "required" })
  .pipe(z.email({ error: "invalidEmail" }).toLowerCase().max(160, { error: "tooLong" }));

export const phone = z
  .string({ error: "required" })
  .trim()
  .min(1, { error: "required" })
  .transform(normalizePhone)
  .pipe(z.string().regex(E164_REGEX, { error: "invalidPhone" }));

export const plateNumber = z
  .string()
  .trim()
  .transform(normalizePlate)
  .pipe(
    z
      .string()
      .min(3, { error: "invalidPlate" })
      .max(20, { error: "invalidPlate" })
      .regex(/^[\p{L}\p{N} -]+$/u, { error: "invalidPlate" }),
  );

export const optionalPlate = z.preprocess(blankToUndefined, plateNumber.optional());

/** YYYY-MM-DD from <input type="date"> → Date (UTC midnight) */
export const optionalDate = z.preprocess(
  blankToUndefined,
  z.iso
    .date({ error: "invalidDate" })
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .optional(),
);

const toNumber = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(",", ".");
    return trimmed === "" ? undefined : Number(trimmed);
  }
  return value;
};

export const optionalYear = z.preprocess(
  toNumber,
  z
    .number({ error: "invalidYear" })
    .int({ error: "invalidYear" })
    .min(1980, { error: "invalidYear" })
    .max(new Date().getFullYear() + 1, { error: "invalidYear" })
    .optional(),
);

export const money = (max = 1000) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: "invalidNumber" })
      .min(0, { error: "outOfRange" })
      .max(max, { error: "outOfRange" }),
  );

export const password = z
  .string({ error: "required" })
  .min(10, { error: "passwordTooShort" })
  .max(128, { error: "tooLong" })
  .regex(/[A-Za-z]/, { error: "passwordWeak" })
  .regex(/\d/, { error: "passwordWeak" });
