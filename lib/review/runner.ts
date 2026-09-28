import type { ObjectId } from "mongodb";
import { reviewRequestsCollection } from "@/lib/db/collections";
import type { ReviewRequestDoc } from "@/lib/db/types";
import { runReviewPipeline } from "@/lib/review/pipeline";
import { createProgressReporter } from "@/lib/review/progress-store";
import { deleteStatusComment, postStatusComment } from "@/lib/review/status-comment";
import { PrClosedError } from "@/lib/review/errors";
import { handleRequestFailure } from "@/lib/review/failure";
import { log, errorFields } from "@/lib/logger";

// The pipeline only heartbeats between stages, and a chunk wave can now hold it
// for CALL_TIMEOUT_MS (plus one retry) with no natural beat in between — far
// past the reaper's 5-minute stale cutoff, which would fail a review that is
// still running. Ticking on a timer keeps the heartbeat a liveness signal.
const HEARTBEAT_INTERVAL_MS = 60_000;

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

/** Returns true only for the caller that moved the request out of `processing`. */
async function markFailed(
  requestId: ObjectId,
  stage: string,
  message: string,
): Promise<boolean> {
  const requests = await reviewRequestsCollection();
  const result = await requests.updateOne(
    { _id: requestId, status: "processing" },
    {
      $set: {
        status: "failed",
        finishedAt: new Date(),
        error: { stage, message },
      },
    },
  );
  return result.modifiedCount === 1;
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

  const ticker = setInterval(() => {
    // A missed beat is survivable; an unhandled rejection here is not.
    void heartbeat().catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);
  ticker.unref();

  // Posted before the pipeline starts so the link is live from the first stage.
  await postStatusComment(request);

  try {
    const progress = createProgressReporter(requestId);
    await progress.stage("preparing");
    await runReviewPipeline(request, heartbeat, progress);
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
    const transitioned = await markFailed(requestId, "pipeline", message);
    log.error("review.pipeline.failed", {
      requestId: requestIdHex,
      durationMs: Date.now() - startedAt,
      ...errorFields(error),
    });
    // If the reaper already failed this run, it owns the follow-up.
    if (transitioned) await handleRequestFailure(requestId);
  } finally {
    clearInterval(ticker);
    // After markCompleted/markFailed/markCancelled: the review (or the failure path) owns the PR now.
    await deleteStatusComment(requestId);
  }
}
