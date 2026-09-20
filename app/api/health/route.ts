import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db/connect";

/** Liveness + database check for uptime monitors and load balancers. */
export async function GET() {
  const started = Date.now();
  try {
    await connectToDatabase();
    await mongoose.connection.db?.admin().ping();
    return Response.json({ status: "ok", database: "up", latencyMs: Date.now() - started });
  } catch {
    return Response.json({ status: "degraded", database: "down" }, { status: 503 });
  }
}
