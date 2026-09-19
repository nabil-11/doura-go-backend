"use server";

import { authorize } from "@/lib/auth/dal";
import { DOCUMENT_KINDS, isDriverAction, type DocumentKind, type DriverStatus } from "@/lib/domain/driver";
import {
  addDriverNote,
  changeDriverStatus,
  createDriver,
  deleteDriver,
  updateDriver,
  uploadDriverDocument,
} from "@/lib/services/drivers";
import { isFilled, validateDocumentFile } from "@/lib/storage/cloudinary";
import { formValues, toFieldErrors, type ActionState, type FieldErrors } from "@/lib/validation/common";
import {
  DRIVER_FIELDS,
  createDriverSchema,
  driverSchema,
  noteSchema,
  statusChangeSchema,
} from "@/lib/validation/driver";

import { revalidateBackoffice, unexpected } from "./shared";

function readDocuments(formData: FormData) {
  const files: Partial<Record<DocumentKind, File>> = {};
  const errors: FieldErrors = {};
  for (const kind of DOCUMENT_KINDS) {
    const value = formData.get(`doc_${kind}`);
    if (!isFilled(value)) continue;
    const error = validateDocumentFile(kind, value);
    if (error) errors[`doc_${kind}`] = error;
    else files[kind] = value;
  }
  return { files, errors };
}

export async function createDriverAction(
  _previous: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const auth = await authorize("drivers:manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = createDriverSchema.safeParse(formValues(formData, [...DRIVER_FIELDS, "initialStatus"]));
  const documents = readDocuments(formData);
  if (!parsed.success || Object.keys(documents.errors).length) {
    return {
      status: "error",
      fieldErrors: { ...(parsed.success ? {} : toFieldErrors(parsed.error)), ...documents.errors },
    };
  }

  try {
    const result = await createDriver(parsed.data, documents.files, auth.admin);
    if (!result.ok) return { status: "error", error: result.error, fieldErrors: result.fieldErrors };
    revalidateBackoffice();
    return { status: "success", data: { id: result.data.id } };
  } catch (error) {
    return unexpected(error);
  }
}

export async function updateDriverAction(
  driverId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize("drivers:manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = driverSchema.safeParse(formValues(formData, DRIVER_FIELDS));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const result = await updateDriver(driverId, parsed.data, auth.admin);
    if (!result.ok) return { status: "error", error: result.error, fieldErrors: result.fieldErrors };
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

export async function changeDriverStatusAction(
  driverId: string,
  action: string,
  reason?: string,
): Promise<ActionState<{ status: DriverStatus }>> {
  const auth = await authorize("drivers:review");
  if (!auth.ok) return { status: "error", error: auth.error };
  if (!isDriverAction(action)) return { status: "error", error: "invalidTransition" };

  const parsed = statusChangeSchema.safeParse({ action, reason });
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const result = await changeDriverStatus(driverId, parsed.data.action, parsed.data.reason, auth.admin);
    if (!result.ok) return { status: "error", error: result.error, fieldErrors: result.fieldErrors };
    revalidateBackoffice();
    return { status: "success", data: result.data };
  } catch (error) {
    return unexpected(error);
  }
}

export async function addDriverNoteAction(
  driverId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize("drivers:review");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = noteSchema.safeParse(formValues(formData, ["note"]));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const result = await addDriverNote(driverId, parsed.data.note, auth.admin);
    if (!result.ok) return { status: "error", error: result.error };
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

export async function uploadDriverDocumentAction(
  driverId: string,
  kind: string,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize("drivers:manage");
  if (!auth.ok) return { status: "error", error: auth.error };
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) return { status: "error", error: "generic" };

  const file = formData.get("file");
  if (!isFilled(file)) return { status: "error", fieldErrors: { file: "required" } };
  const invalid = validateDocumentFile(kind as DocumentKind, file);
  if (invalid) return { status: "error", fieldErrors: { file: invalid } };

  try {
    const result = await uploadDriverDocument(driverId, kind as DocumentKind, file, auth.admin);
    if (!result.ok) return { status: "error", error: result.error };
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}

export async function deleteDriverAction(driverId: string): Promise<ActionState> {
  const auth = await authorize("drivers:delete");
  if (!auth.ok) return { status: "error", error: auth.error };

  try {
    const result = await deleteDriver(driverId, auth.admin);
    if (!result.ok) return { status: "error", error: result.error };
    revalidateBackoffice();
    return { status: "success" };
  } catch (error) {
    return unexpected(error);
  }
}
