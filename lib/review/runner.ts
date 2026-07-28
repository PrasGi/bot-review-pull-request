import type { ObjectId } from "mongodb";
import { reviewRequestsCollection } from "@/lib/db/collections";
import type { ReviewRequestDoc } from "@/lib/db/types";
import { runReviewPipeline } from "@/lib/review/pipeline";

async function claim(requestId: ObjectId): Promise<ReviewRequestDoc | null> {
  const requests = await reviewRequestsCollection();
  const now = new Date();
  return requests.findOneAndUpdate(
    { _id: requestId, status: "queued" },
    { $set: { status: "processing", startedAt: now, heartbeatAt: now } },
    { returnDocument: "after" },
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

export async function runReviewRequest(requestId: ObjectId): Promise<void> {
  const request = await claim(requestId);
  if (!request) return;

  const heartbeat = async (): Promise<void> => {
    const requests = await reviewRequestsCollection();
    await requests.updateOne(
      { _id: requestId, status: "processing" },
      { $set: { heartbeatAt: new Date() } },
    );
  };

  try {
    await runReviewPipeline(request, heartbeat);
    await markCompleted(requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await markFailed(requestId, "pipeline", message);
  }
}
