import type { ObjectId } from "mongodb";
import { reviewRequestsCollection } from "@/lib/db/collections";
import type { ReviewRequestDoc } from "@/lib/db/types";
import { runReviewPipeline } from "@/lib/review/pipeline";
import { PrClosedError } from "@/lib/review/errors";
import { log, errorFields } from "@/lib/logger";

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

async function markCancelled(
  requestId: ObjectId,
  reason: string,
): Promise<void> {
  const requests = await reviewRequestsCollection();
  await requests.updateOne(
    { _id: requestId },
    { $set: { status: "cancelled", cancelReason: reason, finishedAt: new Date() } },
  );
}

export async function runReviewRequest(requestId: ObjectId): Promise<void> {
  const request = await claim(requestId);
  if (!request) return;

  const requestIdHex = requestId.toHexString();
  const startedAt = Date.now();
  log.info("review.pipeline.start", {
    requestId: requestIdHex,
    repoId: request.repoId.toHexString(),
    prNumber: request.prNumber,
    kind: request.kind,
  });

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
    log.info("review.pipeline.completed", {
      requestId: requestIdHex,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof PrClosedError) {
      await markCancelled(requestId, error.reason);
      log.info("review.pipeline.cancelled", {
        requestId: requestIdHex,
        durationMs: Date.now() - startedAt,
        reason: error.reason,
      });
      return;
    }
    const message = error instanceof Error ? error.message : "unknown";
    await markFailed(requestId, "pipeline", message);
    log.error("review.pipeline.failed", {
      requestId: requestIdHex,
      durationMs: Date.now() - startedAt,
      ...errorFields(error),
    });
  }
}
