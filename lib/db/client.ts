import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(getEnv().MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  return client.connect();
}

// Reuse a single connection across HMR reloads (dev) and warm invocations (serverless).
function getClientPromise(): Promise<MongoClient> {
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = createClientPromise();
  }
  return globalThis._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(getEnv().MONGODB_DB_NAME);
}
