import "server-only";

import { Types } from "mongoose";

import type { CurrentAdmin } from "@/lib/auth/dal";
import { connectToDatabase } from "@/lib/db/connect";
import {
  Activity,
  type ActivityAction,
  type ActivityRecord,
  type ActivitySubjectType,
} from "@/lib/db/models/activity";

export type ActivityItem = {
  id: string;
  action: ActivityAction;
  actorName: string | null;
  subjectType: ActivitySubjectType;
  subjectId: string | null;
  subjectLabel: string;
  message: string | null;
  createdAt: Date;
};

type LogInput = {
  action: ActivityAction;
  actor?: Pick<CurrentAdmin, "id" | "name"> | null;
  subject: { type: ActivitySubjectType; id?: string | Types.ObjectId | null; label: string };
  message?: string | null;
};

/** Record an audit entry. Never throws: a logging failure must not break the action. */
export async function logActivity(input: LogInput) {
  try {
    await connectToDatabase();
    await Activity.create({
      action: input.action,
      actor: input.actor ? { id: new Types.ObjectId(input.actor.id), name: input.actor.name } : null,
      subject: {
        type: input.subject.type,
        id: input.subject.id ? new Types.ObjectId(String(input.subject.id)) : null,
        label: input.subject.label,
      },
      message: input.message ?? null,
    });
  } catch (error) {
    console.error("[activity] failed to record", input.action, error);
  }
}

function toItem(record: ActivityRecord): ActivityItem {
  return {
    id: String(record._id),
    action: record.action,
    actorName: record.actor?.name ?? null,
    subjectType: record.subject.type,
    subjectId: record.subject.id ? String(record.subject.id) : null,
    subjectLabel: record.subject.label,
    message: record.message ?? null,
    createdAt: record.createdAt,
  };
}

export async function listRecentActivity(limit = 8) {
  await connectToDatabase();
  const records = await Activity.find().sort({ createdAt: -1 }).limit(limit).lean<ActivityRecord[]>();
  return records.map(toItem);
}

export async function listActivityFor(type: ActivitySubjectType, id: string, limit = 40) {
  await connectToDatabase();
  const records = await Activity.find({ "subject.type": type, "subject.id": new Types.ObjectId(id) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<ActivityRecord[]>();
  return records.map(toItem);
}
