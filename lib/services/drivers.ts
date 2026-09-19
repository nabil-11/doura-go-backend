import "server-only";

import { Types, isValidObjectId, type QueryFilter } from "mongoose";
import { cache } from "react";

import type { CurrentAdmin } from "@/lib/auth/dal";
import { connectToDatabase } from "@/lib/db/connect";
import { Driver, type DriverRecord } from "@/lib/db/models/driver";
import type { StoredFile } from "@/lib/db/models/shared";
import {
  DOCUMENT_KINDS,
  DRIVER_ACTIONS,
  DRIVER_STATUSES,
  getApprovalChecklist,
  type ApprovalChecklist,
  type DocumentKind,
  type DriverAction,
  type DriverAvailability,
  type DriverSource,
  type DriverStatus,
  type VehicleType,
} from "@/lib/domain/driver";
import { avatarUrl, deleteStoredFile, isStorageConfigured, uploadDriverFile } from "@/lib/storage/cloudinary";
import type { ErrorCode, FieldErrors } from "@/lib/validation/common";
import type { ApplicationInput, CreateDriverInput, DriverInput } from "@/lib/validation/driver";

import { logActivity } from "./activity";
import { paginate, searchTerms, type Paginated } from "./query";

export type ServiceResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error?: ErrorCode; fieldErrors?: FieldErrors };

export type DriverListItem = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  status: DriverStatus;
  availability: DriverAvailability;
  source: DriverSource;
  vehicle: {
    type: VehicleType;
    brand: string | null;
    model: string | null;
    plateNumber: string | null;
  };
  rating: { average: number; count: number };
  photoUrl: string | null;
  createdAt: Date;
};

export type DriverDocumentInfo = {
  kind: DocumentKind;
  format: string;
  bytes: number;
  uploadedAt: Date;
};

export type DriverDetail = DriverListItem & {
  email: string | null;
  dateOfBirth: Date | null;
  address: string | null;
  nationalId: string | null;
  license: { number: string | null; expiresAt: Date | null };
  vehicle: DriverListItem["vehicle"] & { year: number | null; color: string | null };
  documents: Partial<Record<DocumentKind, DriverDocumentInfo>>;
  stats: { completedRides: number; earnings: number };
  lastSeenAt: Date | null;
  approvedAt: Date | null;
  review: { at: Date | null; reason: string | null } | null;
  checklist: ApprovalChecklist;
  updatedAt: Date;
};

export type DriverFilters = {
  status?: DriverStatus;
  city?: string;
  q?: string;
  page: number;
  pageSize: number;
};

const fullName = (driver: Pick<DriverRecord, "firstName" | "lastName">) =>
  `${driver.firstName} ${driver.lastName}`.trim();

function toListItem(driver: DriverRecord): DriverListItem {
  return {
    id: String(driver._id),
    name: fullName(driver),
    firstName: driver.firstName,
    lastName: driver.lastName,
    phone: driver.phone,
    city: driver.city,
    status: driver.status,
    availability: driver.availability,
    source: driver.source,
    vehicle: {
      type: driver.vehicle?.type ?? "motorcycle",
      brand: driver.vehicle?.brand ?? null,
      model: driver.vehicle?.model ?? null,
      plateNumber: driver.vehicle?.plateNumber ?? null,
    },
    rating: { average: driver.rating?.average ?? 0, count: driver.rating?.count ?? 0 },
    photoUrl: avatarUrl(driver.documents?.photo),
    createdAt: driver.createdAt,
  };
}

function toDetail(driver: DriverRecord): DriverDetail {
  const documents: DriverDetail["documents"] = {};
  for (const kind of DOCUMENT_KINDS) {
    const file = driver.documents?.[kind];
    if (file) documents[kind] = { kind, format: file.format, bytes: file.bytes, uploadedAt: file.uploadedAt };
  }
  const base = toListItem(driver);
  return {
    ...base,
    photoUrl: avatarUrl(driver.documents?.photo, 320),
    email: driver.email ?? null,
    dateOfBirth: driver.dateOfBirth ?? null,
    address: driver.address ?? null,
    nationalId: driver.nationalId ?? null,
    license: { number: driver.license?.number ?? null, expiresAt: driver.license?.expiresAt ?? null },
    vehicle: {
      ...base.vehicle,
      year: driver.vehicle?.year ?? null,
      color: driver.vehicle?.color ?? null,
    },
    documents,
    stats: {
      completedRides: driver.stats?.completedRides ?? 0,
      earnings: driver.stats?.earnings ?? 0,
    },
    lastSeenAt: driver.lastSeenAt ?? null,
    approvedAt: driver.approvedAt ?? null,
    review: driver.review ? { at: driver.review.at ?? null, reason: driver.review.reason ?? null } : null,
    checklist: getApprovalChecklist(driver),
    updatedAt: driver.updatedAt,
  };
}

function buildFilter({ status, city, q }: Omit<DriverFilters, "page" | "pageSize">) {
  const filter: QueryFilter<DriverRecord> = {};
  if (status) filter.status = status;
  if (city) filter.city = city;
  const terms = searchTerms(q);
  if (terms.length) {
    filter.$and = terms.map((term) => ({
      $or: [
        { firstName: term.text },
        { lastName: term.text },
        { "vehicle.plateNumber": term.text },
        ...(term.digits.length >= 2 ? [{ phone: new RegExp(term.digits) }] : []),
      ],
    }));
  }
  return filter;
}

export async function listDrivers(filters: DriverFilters): Promise<Paginated<DriverListItem>> {
  await connectToDatabase();
  const filter = buildFilter(filters);
  const [records, total] = await Promise.all([
    Driver.find(filter)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.pageSize)
      .limit(filters.pageSize)
      .lean<DriverRecord[]>(),
    Driver.countDocuments(filter),
  ]);
  return paginate(records.map(toListItem), total, filters.page, filters.pageSize);
}

/** Counts per status for the list tabs, using the same search and city filters. */
export const countDriversByStatus = cache(async (filters: Pick<DriverFilters, "city" | "q"> = {}) => {
  await connectToDatabase();
  const rows = await Driver.aggregate<{ _id: DriverStatus; count: number }>([
    { $match: buildFilter(filters) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(DRIVER_STATUSES.map((status) => [status, 0])) as Record<DriverStatus, number>;
  for (const row of rows) counts[row._id] = row.count;
  const all = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return { ...counts, all };
});

export async function countOnlineDrivers() {
  await connectToDatabase();
  return Driver.countDocuments({ status: "active", availability: { $in: ["online", "on_trip"] } });
}

export async function listPendingDrivers(limit = 5) {
  await connectToDatabase();
  const records = await Driver.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<DriverRecord[]>();
  return records.map(toListItem);
}

export async function getDriver(id: string): Promise<DriverDetail | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const driver = await Driver.findById(id).lean<DriverRecord>();
  return driver ? toDetail(driver) : null;
}

export async function getDriverFile(id: string, kind: DocumentKind): Promise<StoredFile | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const driver = await Driver.findById(id).select("documents").lean<Pick<DriverRecord, "documents">>();
  return driver?.documents?.[kind] ?? null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

async function uniquenessErrors(phone: string, plate: string | undefined | null, excludeId?: string) {
  const exclude = excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {};
  const [phoneTaken, plateTaken] = await Promise.all([
    Driver.exists({ phone, ...exclude }),
    plate ? Driver.exists({ "vehicle.plateNumber": plate, ...exclude }) : null,
  ]);
  const errors: FieldErrors = {};
  if (phoneTaken) errors.phone = "phoneTaken";
  if (plateTaken) errors.plateNumber = "plateTaken";
  return Object.keys(errors).length ? errors : null;
}

function duplicateKeyErrors(error: unknown): FieldErrors | null {
  if (typeof error !== "object" || error === null || (error as { code?: number }).code !== 11000) return null;
  const keys = Object.keys((error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {});
  const errors: FieldErrors = {};
  if (keys.includes("phone")) errors.phone = "phoneTaken";
  if (keys.includes("vehicle.plateNumber")) errors.plateNumber = "plateTaken";
  return Object.keys(errors).length ? errors : { form: "generic" };
}

function profileFields(input: DriverInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    city: input.city,
    address: input.address ?? null,
    nationalId: input.nationalId ?? null,
    license: { number: input.licenseNumber ?? null, expiresAt: input.licenseExpiry ?? null },
    vehicle: {
      type: input.vehicleType,
      brand: input.vehicleBrand ?? null,
      model: input.vehicleModel ?? null,
      year: input.vehicleYear ?? null,
      color: input.vehicleColor ?? null,
      plateNumber: input.plateNumber ?? null,
    },
  };
}

async function removeFiles(files: Partial<Record<DocumentKind, StoredFile>>) {
  await Promise.allSettled(Object.values(files).map((file) => deleteStoredFile(file)));
}

/** Field-level explanation of why a driver can't be active yet. */
function checklistFieldErrors(input: DriverInput, files: Partial<Record<DocumentKind, unknown>>, now: Date) {
  const errors: FieldErrors = {};
  const checklist = getApprovalChecklist(
    {
      documents: files,
      license: { number: input.licenseNumber, expiresAt: input.licenseExpiry },
      vehicle: { brand: input.vehicleBrand, model: input.vehicleModel, plateNumber: input.plateNumber },
    },
    now,
  );
  if (checklist.ready) return null;
  for (const kind of checklist.missingDocuments) errors[`doc_${kind}`] = "required";
  if (!input.licenseNumber) errors.licenseNumber = "required";
  if (!input.licenseExpiry) errors.licenseExpiry = "required";
  else if (input.licenseExpiry.getTime() <= now.getTime()) errors.licenseExpiry = "licenseExpired";
  if (!input.vehicleBrand) errors.vehicleBrand = "required";
  if (!input.vehicleModel) errors.vehicleModel = "required";
  if (!input.plateNumber) errors.plateNumber = "required";
  return errors;
}

export async function createDriver(
  input: CreateDriverInput,
  files: Partial<Record<DocumentKind, File>>,
  actor: CurrentAdmin,
): Promise<ServiceResult<{ id: string }>> {
  await connectToDatabase();

  const duplicate = await uniquenessErrors(input.phone, input.plateNumber);
  if (duplicate) return { ok: false, fieldErrors: duplicate };

  const now = new Date();
  if (input.initialStatus === "active") {
    const errors = checklistFieldErrors(input, files, now);
    if (errors) return { ok: false, error: "checklistIncomplete", fieldErrors: errors };
  }

  const hasFiles = Object.keys(files).length > 0;
  if (hasFiles && !isStorageConfigured()) return { ok: false, error: "uploadsDisabled" };

  const id = new Types.ObjectId();
  const uploaded: Partial<Record<DocumentKind, StoredFile>> = {};
  try {
    await Promise.all(
      (Object.entries(files) as [DocumentKind, File][]).map(async ([kind, file]) => {
        uploaded[kind] = await uploadDriverFile(String(id), kind, file, new Types.ObjectId(actor.id));
      }),
    );
  } catch (error) {
    console.error("[drivers] upload failed", error);
    await removeFiles(uploaded);
    return { ok: false, error: "uploadFailed" };
  }

  const active = input.initialStatus === "active";
  try {
    await Driver.create({
      _id: id,
      ...profileFields(input),
      status: input.initialStatus,
      source: "admin",
      documents: uploaded,
      approvedAt: active ? now : null,
      review: active ? { by: new Types.ObjectId(actor.id), at: now, reason: null } : undefined,
    });
  } catch (error) {
    await removeFiles(uploaded);
    const fieldErrors = duplicateKeyErrors(error);
    if (fieldErrors) return { ok: false, fieldErrors };
    throw error;
  }

  await logActivity({
    action: "driver.created",
    actor,
    subject: { type: "driver", id, label: fullName(input) },
  });
  return { ok: true, data: { id: String(id) } };
}

export async function updateDriver(id: string, input: DriverInput, actor: CurrentAdmin): Promise<ServiceResult> {
  if (!isValidObjectId(id)) return { ok: false, error: "notFound" };
  await connectToDatabase();

  const duplicate = await uniquenessErrors(input.phone, input.plateNumber, id);
  if (duplicate) return { ok: false, fieldErrors: duplicate };

  try {
    const result = await Driver.updateOne({ _id: id }, { $set: profileFields(input) });
    if (result.matchedCount === 0) return { ok: false, error: "notFound" };
  } catch (error) {
    const fieldErrors = duplicateKeyErrors(error);
    if (fieldErrors) return { ok: false, fieldErrors };
    throw error;
  }

  await logActivity({ action: "driver.updated", actor, subject: { type: "driver", id, label: fullName(input) } });
  return { ok: true, data: undefined };
}

/**
 * Public application from the website. A phone number that already exists is
 * accepted silently (no duplicate profile, and no way to probe who applied).
 */
export async function createApplication(input: ApplicationInput): Promise<ServiceResult> {
  await connectToDatabase();

  if (await Driver.exists({ phone: input.phone })) return { ok: true, data: undefined };
  if (input.plateNumber && (await Driver.exists({ "vehicle.plateNumber": input.plateNumber }))) {
    return { ok: false, fieldErrors: { plateNumber: "plateTaken" } };
  }

  let driver;
  try {
    driver = await Driver.create({
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email ?? null,
      city: input.city,
      status: "pending",
      source: "website",
      license: { number: input.licenseNumber ?? null, expiresAt: null },
      vehicle: {
        type: input.vehicleType,
        brand: input.vehicleBrand,
        model: input.vehicleModel ?? null,
        year: input.vehicleYear ?? null,
        plateNumber: input.plateNumber ?? null,
      },
    });
  } catch (error) {
    const fieldErrors = duplicateKeyErrors(error);
    if (fieldErrors?.phone) return { ok: true, data: undefined };
    if (fieldErrors) return { ok: false, fieldErrors };
    throw error;
  }

  await logActivity({
    action: "driver.applied",
    actor: null,
    subject: { type: "driver", id: driver._id, label: fullName(input) },
  });
  return { ok: true, data: undefined };
}

const ACTION_LOG = {
  approve: "driver.approved",
  reject: "driver.rejected",
  suspend: "driver.suspended",
  reactivate: "driver.reactivated",
  reopen: "driver.reopened",
} as const satisfies Record<DriverAction, string>;

export async function changeDriverStatus(
  id: string,
  action: DriverAction,
  reason: string | undefined,
  actor: CurrentAdmin,
): Promise<ServiceResult<{ status: DriverStatus }>> {
  if (!isValidObjectId(id)) return { ok: false, error: "notFound" };
  const rule = DRIVER_ACTIONS[action];
  if (rule.requiresReason && !reason) return { ok: false, fieldErrors: { reason: "required" } };

  await connectToDatabase();
  const driver = await Driver.findById(id).lean<DriverRecord>();
  if (!driver) return { ok: false, error: "notFound" };
  if (!(rule.from as readonly DriverStatus[]).includes(driver.status)) {
    return { ok: false, error: "invalidTransition" };
  }
  if (rule.to === "active" && !getApprovalChecklist(driver).ready) {
    return { ok: false, error: "checklistIncomplete" };
  }

  const now = new Date();
  const update: Record<string, unknown> = {
    status: rule.to,
    review: { by: new Types.ObjectId(actor.id), at: now, reason: reason ?? null },
  };
  if (rule.to !== "active") update.availability = "offline";
  if (action === "approve") update.approvedAt = now;

  // The status precondition makes concurrent reviews safe.
  const result = await Driver.updateOne({ _id: id, status: driver.status }, { $set: update });
  if (result.modifiedCount === 0) return { ok: false, error: "invalidTransition" };

  await logActivity({
    action: ACTION_LOG[action],
    actor,
    subject: { type: "driver", id, label: fullName(driver) },
    message: reason ?? null,
  });
  return { ok: true, data: { status: rule.to } };
}

export async function addDriverNote(id: string, note: string, actor: CurrentAdmin): Promise<ServiceResult> {
  if (!isValidObjectId(id)) return { ok: false, error: "notFound" };
  await connectToDatabase();
  const driver = await Driver.findById(id).select("firstName lastName").lean<DriverRecord>();
  if (!driver) return { ok: false, error: "notFound" };
  await logActivity({
    action: "driver.note_added",
    actor,
    subject: { type: "driver", id, label: fullName(driver) },
    message: note,
  });
  return { ok: true, data: undefined };
}

export async function uploadDriverDocument(
  id: string,
  kind: DocumentKind,
  file: File,
  actor: CurrentAdmin,
): Promise<ServiceResult> {
  if (!isValidObjectId(id)) return { ok: false, error: "notFound" };
  if (!isStorageConfigured()) return { ok: false, error: "uploadsDisabled" };
  await connectToDatabase();

  const driver = await Driver.findById(id).select("firstName lastName").lean<DriverRecord>();
  if (!driver) return { ok: false, error: "notFound" };

  let stored: StoredFile;
  try {
    stored = await uploadDriverFile(id, kind, file, new Types.ObjectId(actor.id));
  } catch (error) {
    console.error("[drivers] document upload failed", error);
    return { ok: false, error: "uploadFailed" };
  }

  await Driver.updateOne({ _id: id }, { $set: { [`documents.${kind}`]: stored } });
  await logActivity({
    action: "driver.document_uploaded",
    actor,
    subject: { type: "driver", id, label: fullName(driver) },
    message: kind,
  });
  return { ok: true, data: undefined };
}

export async function deleteDriver(id: string, actor: CurrentAdmin): Promise<ServiceResult> {
  if (!isValidObjectId(id)) return { ok: false, error: "notFound" };
  await connectToDatabase();

  const driver = await Driver.findByIdAndDelete(id).lean<DriverRecord>();
  if (!driver) return { ok: false, error: "notFound" };

  if (driver.documents && isStorageConfigured()) {
    await removeFiles(driver.documents);
  }
  await logActivity({
    action: "driver.deleted",
    actor,
    subject: { type: "driver", id, label: fullName(driver) },
  });
  return { ok: true, data: undefined };
}
