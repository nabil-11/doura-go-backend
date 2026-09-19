// MongoDB connection shared across requests (and across hot reloads in dev).
// Imported only from server code; not marked `server-only` so CLI scripts
// (scripts/*.ts) can reuse it.

import mongoose from "mongoose";

type ConnectionCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & { __mongoose?: ConnectionCache };
const cache: ConnectionCache = (globalForMongoose.__mongoose ??= { conn: null, promise: null });

mongoose.set("strictQuery", true);

export async function connectToDatabase() {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error("MONGO_URL is not set. Add it to your .env file.");

  cache.promise ??= mongoose
    .connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    })
    .catch((error: unknown) => {
      cache.promise = null;
      throw error;
    });

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectFromDatabase() {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
