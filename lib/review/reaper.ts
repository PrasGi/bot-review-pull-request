import type { ObjectId } from "mongodb";
import { reviewRequestsCollection } from "@/lib/db/collections";

const STALE_HEARTBEAT_MS = 5 * 60 * 1000;

/**
 * Fails runs whose heartbeat went stale (the process died mid-review) and returns
 * the ids this call failed, so the caller can run the failure follow-up for each.
 */
export async function reapStuckRequests(): Promise<ObjectId[]> {
  const requests = await reviewRequestsCollection();
  const cutoff = new Date(Date.now() - STALE_HEARTBEAT_MS);
  const stale = await requests
    .find({ status: "processing", heartbeatAt: { $lt: cutoff } }, { projection: { _id: 1 } })
    .toArray();

  const reaped: ObjectId[] = [];
  for (const { _id } of stale) {
    // Conditional per doc: a runner finishing at the same moment keeps its result.
    const result = await requests.updateOne(
      { _id, status: "processing", heartbeatAt: { $lt: cutoff } },
      {
        $set: {
          status: "failed",
          finishedAt: new Date(),
          error: { stage: "timeout", message: "runner died (stale heartbeat)" },
        },
      },
    );
    if (result.modifiedCount === 1) reaped.push(_id);
  }
  return reaped;
}
