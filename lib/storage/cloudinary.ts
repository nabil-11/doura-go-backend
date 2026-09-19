import "server-only";

import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";

import type { StoredFile } from "@/lib/db/models/shared";
import {
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  PHOTO_MIME_TYPES,
  type DocumentKind,
} from "@/lib/domain/driver";
import type { ValidationCode } from "@/lib/validation/common";

// The SDK reads CLOUDINARY_URL (cloudinary://key:secret@cloud) from the environment.
cloudinary.config({ secure: true });

const ROOT_FOLDER = "doura-go";

export function isStorageConfigured() {
  return !!process.env.CLOUDINARY_URL;
}

/** A real file was selected (browsers send an empty part for untouched inputs). */
export function isFilled(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "size" in value && value.size > 0;
}

export function validateDocumentFile(kind: DocumentKind, file: File): ValidationCode | null {
  const allowed: readonly string[] = kind === "photo" ? PHOTO_MIME_TYPES : DOCUMENT_MIME_TYPES;
  if (!allowed.includes(file.type)) return "fileType";
  if (file.size > MAX_DOCUMENT_BYTES) return "fileTooLarge";
  return null;
}

function uploadBuffer(buffer: Buffer, options: UploadApiOptions) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) reject(error ?? new Error("Upload failed"));
      else resolve(result);
    });
    stream.end(buffer);
  });
}

/**
 * Upload a driver file. The profile photo is public (shown to riders);
 * identity documents are "authenticated" assets that can only be read through
 * a signed URL generated on the server (see the documents route handler).
 */
export async function uploadDriverFile(
  driverId: string,
  kind: DocumentKind,
  file: File,
  uploadedBy: StoredFile["uploadedBy"] = null,
): Promise<StoredFile> {
  const deliveryType: StoredFile["deliveryType"] = kind === "photo" ? "upload" : "authenticated";
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await uploadBuffer(buffer, {
    folder: `${ROOT_FOLDER}/drivers/${driverId}`,
    public_id: kind,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    type: deliveryType,
    tags: [ROOT_FOLDER, "driver", kind],
  });

  return {
    publicId: result.public_id,
    deliveryType,
    resourceType: result.resource_type,
    format: result.format,
    version: result.version,
    bytes: result.bytes,
    url: result.secure_url,
    uploadedAt: new Date(),
    uploadedBy,
  };
}

export async function deleteStoredFile(file: Pick<StoredFile, "publicId" | "deliveryType" | "resourceType">) {
  await cloudinary.uploader.destroy(file.publicId, {
    type: file.deliveryType,
    resource_type: file.resourceType as "image",
    invalidate: true,
  });
}

/** Square, face-centred avatar for public photos. */
export function avatarUrl(file: Pick<StoredFile, "publicId" | "version"> | null | undefined, size = 160) {
  if (!file) return null;
  return cloudinary.url(file.publicId, {
    secure: true,
    version: file.version,
    transformation: [{ width: size, height: size, crop: "thumb", gravity: "face" }, { fetch_format: "auto", quality: "auto" }],
  });
}

/** Signed delivery URL for a stored document (original file or a JPG preview). */
export function signedFileUrl(file: StoredFile, variant: "original" | "preview") {
  const isPdf = file.format === "pdf";
  if (variant === "preview") {
    return cloudinary.url(file.publicId, {
      secure: true,
      sign_url: file.deliveryType === "authenticated",
      type: file.deliveryType,
      resource_type: file.resourceType,
      version: file.version,
      format: "jpg",
      transformation: [{ width: 720, crop: "limit", ...(isPdf ? { page: 1 } : {}) }, { quality: "auto" }],
    });
  }
  return cloudinary.url(file.publicId, {
    secure: true,
    sign_url: file.deliveryType === "authenticated",
    type: file.deliveryType,
    resource_type: file.resourceType,
    version: file.version,
    format: file.format,
  });
}
