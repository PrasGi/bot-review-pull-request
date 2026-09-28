import { ObjectId } from "mongodb";
import {
  reposCollection,
  reviewRequestsCollection,
  reviewsCollection,
} from "@/lib/db/collections";
import type { ReviewRequestDoc } from "@/lib/db/types";
import { createRetryRequest } from "@/lib/dashboard/retry";
import { postIssueComment } from "@/lib/github/pr";
import { deleteStatusComment } from "@/lib/review/status-comment";
import { getValidAccessToken } from "@/lib/github/tokens";
import { buildFailureComment } from "@/lib/review/summary";
import { log, errorFields } from "@/lib/logger";

/** Pause before the automatic retry, so a transient provider or GitHub outage can clear. */
export const AUTO_RETRY_DELAY_MS = 60_000;

export interface FailureDeps {
  sleep: (ms: number) => Promise<void>;
  /** Runs a queued request to completion (the runner). */
  run: (requestId: ObjectId) => Promise<void>;
  postComment: (request: ReviewRequestDoc, body: string) => Promise<void>;
  deleteStatus: (requestId: ObjectId) => Promise<void>;
}

async function postFailureComment(request: ReviewRequestDoc, body: string): Promise<void> {
  const repos = await reposCollection();
  const repo = await repos.findOne({ _id: request.repoId });
  if (!repo) throw new Error("repo not found");
  const [owner, name] = repo.fullName.split("/");
  if (!owner || !name) throw new Error(`invalid repo name: ${repo.fullName}`);
  const token = await getValidAccessToken(request.userConnectionId);
  await postIssueComment(token, owner, name, request.prNumber, body);
}

const defaultDeps: FailureDeps = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  // Imported lazily: the runner calls this module, so a static import would be circular.
  run: async (requestId) => {
    const { runReviewRequest } = await import("@/lib/review/runner");
    await runReviewRequest(requestId);
  },
  postComment: postFailureComment,
  deleteStatus: deleteStatusComment,
};

export type FailureOutcome =
  | "not_found"
  | "review_already_posted"
  | "retried"
  | "retry_skipped_active"
  | "retry_not_created"
  | "commented"
  | "already_notified"
  | "comment_failed"
  | "handler_failed";

/**
 * Called once per request that transitioned to `failed`. The first failure gets one
 * automatic retry; when that retry fails too, the PR gets a single comment saying the
 * review could not be completed. Never throws and never changes the request's status.
 */
export async function handleRequestFailure(
  requestId: ObjectId,
  deps: FailureDeps = defaultDeps,
): Promise<FailureOutcome> {
  const requestIdHex = requestId.toHexString();
  try {
    const requests = await reviewRequestsCollection();
    const request = await requests.findOne({ _id: requestId });
    if (!request) return "not_found";
    // A run reaped after its process died still has its status comment up.
    await deps.deleteStatus(requestId);

    // A failure after the review was submitted (e.g. while persisting it) must not
    // produce a second review or a contradicting comment.
    const reviews = await reviewsCollection();
    if (await reviews.findOne({ requestId })) return "review_already_posted";

    if (request.trigger !== "auto_retry") {
      await deps.sleep(AUTO_RETRY_DELAY_MS);
      const retry = await createRetryRequest(request, "auto_retry");
      if (!retry.ok) {
        // Another run for this PR started in the meantime and already covers it.
        if (retry.reason === "already_active") return "retry_skipped_active";
        log.warn("review.auto_retry.not_created", { requestId: requestIdHex, reason: retry.reason });
        return "retry_not_created";
      }
      log.info("review.auto_retry.queued", { requestId: requestIdHex, retryId: retry.requestId });
      await deps.run(new ObjectId(retry.requestId));
      return "retried";
    }

    // Claim the notification atomically, so the runner and the reaper can't both post.
    const claimed = await requests.updateOne(
      { _id: requestId, failureNotifiedAt: { $exists: false } },
      { $set: { failureNotifiedAt: new Date() } },
    );
    if (claimed.modifiedCount !== 1) return "already_notified";

    try {
      await deps.postComment(request, buildFailureComment(request.headSha));
      log.info("review.failure_comment.posted", { requestId: requestIdHex, prNumber: request.prNumber });
      return "commented";
    } catch (error) {
      log.error("review.failure_comment.failed", { requestId: requestIdHex, ...errorFields(error) });
      return "comment_failed";
    }
  } catch (error) {
    log.error("review.failure_handler.failed", { requestId: requestIdHex, ...errorFields(error) });
    return "handler_failed";
  }
}
