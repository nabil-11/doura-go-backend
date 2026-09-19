// Driver business rules. Pure functions — safe to use on the server (to
// enforce) and in the UI (to explain what's possible).

export const DRIVER_STATUSES = ["pending", "active", "suspended", "rejected"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DRIVER_AVAILABILITY = ["offline", "online", "on_trip"] as const;
export type DriverAvailability = (typeof DRIVER_AVAILABILITY)[number];

export const DRIVER_SOURCES = ["website", "admin"] as const;
export type DriverSource = (typeof DRIVER_SOURCES)[number];

export const VEHICLE_TYPES = ["motorcycle", "scooter"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const DOCUMENT_KINDS = ["photo", "license", "idCard", "registration", "insurance"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Documents that must be on file before a driver can be approved. */
export const REQUIRED_DOCUMENTS: readonly DocumentKind[] = ["photo", "license", "idCard", "registration"];

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Allowed status changes. Anything not listed here is rejected by the server. */
export const DRIVER_ACTIONS = {
  approve: { from: ["pending"], to: "active", requiresReason: false },
  reject: { from: ["pending"], to: "rejected", requiresReason: true },
  suspend: { from: ["active"], to: "suspended", requiresReason: true },
  reactivate: { from: ["suspended"], to: "active", requiresReason: false },
  reopen: { from: ["rejected"], to: "pending", requiresReason: false },
} as const satisfies Record<
  string,
  { from: readonly DriverStatus[]; to: DriverStatus; requiresReason: boolean }
>;

export type DriverAction = keyof typeof DRIVER_ACTIONS;

export const DRIVER_ACTION_NAMES = Object.keys(DRIVER_ACTIONS) as DriverAction[];

export function isDriverAction(value: unknown): value is DriverAction {
  return typeof value === "string" && value in DRIVER_ACTIONS;
}

export function availableActions(status: DriverStatus): DriverAction[] {
  return DRIVER_ACTION_NAMES.filter((action) =>
    (DRIVER_ACTIONS[action].from as readonly DriverStatus[]).includes(status),
  );
}

type ChecklistInput = {
  documents?: Partial<Record<DocumentKind, unknown>> | null;
  license?: { number?: string | null; expiresAt?: Date | string | null } | null;
  vehicle?: { brand?: string | null; model?: string | null; plateNumber?: string | null } | null;
};

export type ApprovalChecklist = {
  documents: boolean;
  license: boolean;
  vehicle: boolean;
  ready: boolean;
  missingDocuments: DocumentKind[];
};

export function getApprovalChecklist(driver: ChecklistInput, now: Date = new Date()): ApprovalChecklist {
  const missingDocuments = REQUIRED_DOCUMENTS.filter((kind) => !driver.documents?.[kind]);
  const expiresAt = driver.license?.expiresAt ? new Date(driver.license.expiresAt) : null;
  const license = !!driver.license?.number && !!expiresAt && expiresAt.getTime() > now.getTime();
  const vehicle = !!driver.vehicle?.brand && !!driver.vehicle?.model && !!driver.vehicle?.plateNumber;
  const documents = missingDocuments.length === 0;
  return { documents, license, vehicle, ready: documents && license && vehicle, missingDocuments };
}

/** Normalises a phone number to E.164. 8-digit numbers are treated as Tunisian (+216). */
export function normalizePhone(input: string) {
  const compact = input.replace(/[\s\-().]/g, "");
  const withPlus = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (/^\d{8}$/.test(withPlus)) return `+216${withPlus}`;
  if (/^216\d{8}$/.test(withPlus)) return `+${withPlus}`;
  return withPlus;
}

export const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/** Uppercase, single-spaced plate number. */
export function normalizePlate(input: string) {
  return input.trim().replace(/\s+/g, " ").toUpperCase();
}

export function ageFrom(dateOfBirth: Date | string | null | undefined, now: Date = new Date()) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
