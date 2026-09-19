import "server-only";

import { isValidObjectId, type QueryFilter } from "mongoose";

import type { CurrentAdmin } from "@/lib/auth/dal";
import { connectToDatabase } from "@/lib/db/connect";
import { Rider, type RiderRecord } from "@/lib/db/models/rider";
import type { RiderStatus } from "@/lib/domain/ride";

import { logActivity } from "./activity";
import type { ServiceResult } from "./drivers";
import { paginate, searchTerms, type Paginated } from "./query";

export type RiderListItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: RiderStatus;
  rating: { average: number; count: number };
  completedRides: number;
  lastRideAt: Date | null;
  createdAt: Date;
};

function buildFilter(status: RiderStatus | undefined, q: string | undefined) {
  const filter: QueryFilter<RiderRecord> = {};
  if (status) filter.status = status;
  const terms = searchTerms(q);
  if (terms.length) {
    filter.$and = terms.map((term) => ({
      $or: [{ name: term.text }, ...(term.digits.length >= 2 ? [{ phone: new RegExp(term.digits) }] : [])],
    }));
  }
  return filter;
}

function toItem(rider: RiderRecord): RiderListItem {
  return {
    id: String(rider._id),
    name: rider.name,
    phone: rider.phone,
    email: rider.email ?? null,
    status: rider.status,
    rating: { average: rider.rating?.average ?? 0, count: rider.rating?.count ?? 0 },
    completedRides: rider.stats?.completedRides ?? 0,
    lastRideAt: rider.lastRideAt ?? null,
    createdAt: rider.createdAt,
  };
}

export async function listRiders(options: {
  status?: RiderStatus;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<Paginated<RiderListItem>> {
  await connectToDatabase();
  const filter = buildFilter(options.status, options.q);
  const [riders, total] = await Promise.all([
    Rider.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.pageSize)
      .limit(options.pageSize)
      .lean<RiderRecord[]>(),
    Rider.countDocuments(filter),
  ]);
  return paginate(riders.map(toItem), total, options.page, options.pageSize);
}

export async function countRidersByStatus(q?: string) {
  await connectToDatabase();
  const [all, active, blocked] = await Promise.all([
    Rider.countDocuments(buildFilter(undefined, q)),
    Rider.countDocuments(buildFilter("active", q)),
    Rider.countDocuments(buildFilter("blocked", q)),
  ]);
  return { all, active, blocked };
}

export async function setRiderBlocked(id: string, blocked: boolean, actor: CurrentAdmin): Promise<ServiceResult> {
  if (!isValidObjectId(id)) return { ok: false, error: "notFound" };
  await connectToDatabase();
  const rider = await Rider.findByIdAndUpdate(
    id,
    { $set: { status: blocked ? "blocked" : "active" } },
    { returnDocument: "after" },
  ).lean<RiderRecord>();
  if (!rider) return { ok: false, error: "notFound" };

  await logActivity({
    action: blocked ? "rider.blocked" : "rider.unblocked",
    actor,
    subject: { type: "rider", id, label: rider.name },
  });
  return { ok: true, data: undefined };
}
