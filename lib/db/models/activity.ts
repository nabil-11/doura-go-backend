import { Schema, model, models, type Model, type Types } from "mongoose";

export const ACTIVITY_ACTIONS = [
  "driver.applied",
  "driver.created",
  "driver.updated",
  "driver.approved",
  "driver.rejected",
  "driver.suspended",
  "driver.reactivated",
  "driver.reopened",
  "driver.deleted",
  "driver.document_uploaded",
  "driver.note_added",
  "driver.payment_recorded",
  "rider.blocked",
  "rider.unblocked",
  "pricing.updated",
  "admin.created",
  "admin.role_changed",
  "admin.disabled",
  "admin.enabled",
  "admin.password_changed",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_SUBJECTS = ["driver", "rider", "admin", "pricing"] as const;
export type ActivitySubjectType = (typeof ACTIVITY_SUBJECTS)[number];

/**
 * Audit trail of backoffice actions. Names are copied at write time so the
 * history stays readable after people or drivers are deleted.
 */
export interface ActivityRecord {
  _id: Types.ObjectId;
  action: ActivityAction;
  actor?: { id: Types.ObjectId; name: string } | null;
  subject: { type: ActivitySubjectType; id?: Types.ObjectId | null; label: string };
  /** Optional free text: rejection reason, internal note… */
  message?: string | null;
  createdAt: Date;
}

const activitySchema = new Schema<ActivityRecord>(
  {
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    actor: {
      type: new Schema(
        {
          id: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
          name: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    subject: {
      type: { type: String, enum: ACTIVITY_SUBJECTS, required: true },
      id: { type: Schema.Types.ObjectId, default: null },
      label: { type: String, required: true },
    },
    message: { type: String, trim: true, maxlength: 1000, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ "subject.type": 1, "subject.id": 1, createdAt: -1 });

export const Activity: Model<ActivityRecord> =
  (models.Activity as Model<ActivityRecord> | undefined) ??
  model<ActivityRecord>("Activity", activitySchema);
