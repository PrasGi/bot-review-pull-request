import type { ObjectId } from "mongodb";
import { reviewRequestsCollection } from "@/lib/db/collections";

const WALL_CLOCK_BUDGET_MS = 240_000;

async function claim(requestId: ObjectId): Promise<boolean> {
  const requests = await reviewRequestsCollection();
  const now = new Date();
  const result = await requests.updateOne(
    { _id: requestId, status: "queued" },
    { $set: { status: "processing", startedAt: now, heartbeatAt: now } },
  );
  return result.modifiedCount === 1;
}

async function heartbeat(requestId: ObjectId): Promise<void> {
  const requests = await reviewRequestsCollection();
  await requests.updateOne(
    { _id: requestId, status: "processing" },
    { $set: { heartbeatAt: new Date() } },
  );
}

async function markCompleted(requestId: ObjectId): Promise<void> {
  const requests = await reviewRequestsCollection();
  await requests.updateOne(
    { _id: requestId },
    { $set: { status: "completed", finishedAt: new Date() } },
  );
}

async function markFailed(
  requestId: ObjectId,
  stage: string,
  message: string,
): Promise<void> {
  const requests = await reviewRequestsCollection();
  await requests.updateOne(
    { _id: requestId },
    {
      $set: {
        status: "failed",
        finishedAt: new Date(),
        error: { stage, message },
      },
    },
  );
}

// Phase 1 stub: claims the request, heartbeats, and completes. The real review
// pipeline (fetch PR, filter, chunk, AI, submit) lands in Phase 2 (F3/F4).
export async function runReviewRequest(requestId: ObjectId): Promise<void> {
  const claimed = await claim(requestId);
  if (!claimed) return;

  const startedAt = Date.now();
  try {
    await heartbeat(requestId);
    if (Date.now() - startedAt > WALL_CLOCK_BUDGET_MS) {
      throw new Error("wall_clock_budget_exceeded");
    }
    await markCompleted(requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await markFailed(requestId, "pipeline", message);
  }
}
