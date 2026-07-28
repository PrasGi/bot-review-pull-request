import { reviewRequestsCollection } from "@/lib/db/collections";

const STALE_HEARTBEAT_MS = 5 * 60 * 1000;

export async function reapStuckRequests(): Promise<number> {
  const requests = await reviewRequestsCollection();
  const cutoff = new Date(Date.now() - STALE_HEARTBEAT_MS);
  const result = await requests.updateMany(
    { status: "processing", heartbeatAt: { $lt: cutoff } },
    {
      $set: {
        status: "failed",
        finishedAt: new Date(),
        error: { stage: "timeout", message: "runner died (stale heartbeat)" },
      },
    },
  );
  return result.modifiedCount;
}
