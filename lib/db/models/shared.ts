import { Schema, type Types } from "mongoose";

/** GeoJSON point: coordinates are [longitude, latitude]. */
export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export const pointSchema = new Schema<GeoPoint>(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]) => value.length === 2,
        message: "A point needs [longitude, latitude].",
      },
    },
  },
  { _id: false },
);

export interface StoredFile {
  publicId: string;
  /** Cloudinary delivery type: public ("upload") or signed-only ("authenticated") */
  deliveryType: "upload" | "authenticated";
  resourceType: string;
  format: string;
  version: number;
  bytes: number;
  url: string;
  uploadedAt: Date;
  uploadedBy?: Types.ObjectId | null;
}

export const storedFileSchema = new Schema<StoredFile>(
  {
    publicId: { type: String, required: true },
    deliveryType: { type: String, enum: ["upload", "authenticated"], required: true },
    resourceType: { type: String, required: true },
    format: { type: String, required: true },
    version: { type: Number, required: true },
    bytes: { type: Number, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { _id: false },
);
