import { reviewRequestsCollection } from "@/lib/db/collections";
import { resolveTenant } from "@/lib/webhook/tenant";
import { enqueueReviewRequest } from "@/lib/review/enqueue";
import type { PullRequestEvent } from "@/lib/webhook/payloads";
import type { ObjectId } from "mongodb";

export type TriggerOutcome =
  | { status: "queued"; requestId: ObjectId }
  | { status: "skipped_draft"; requestId: ObjectId }
  | { status: "superseded" }
  | { status: "cancelled"; reason: string }
  | { status: "flagged_newer_commits" }
  | { status: "ignored"; reason: string };

async function cancelQueued(
  repoId: ObjectId,
  prNumber: number,
  reason: string,
): Promise<void> {
  const requests = await reviewRequestsCollection();
  await requests.updateMany(
    { repoId, prNumber, status: "queued" },
    { $set: { status: "cancelled", cancelReason: reason, finishedAt: new Date() } },
  );
}

async function flagNewerCommits(
  repoId: ObjectId,
  prNumber: number,
): Promise<boolean> {
  const requests = await reviewRequestsCollection();
  const result = await requests.updateOne(
    { repoId, prNumber, status: "processing" },
    { $set: { newerCommitsFlag: true } },
  );
  return result.modifiedCount > 0;
}

async function hasSkippedDraft(
  repoId: ObjectId,
  prNumber: number,
): Promise<boolean> {
  const requests = await reviewRequestsCollection();
  const doc = await requests.findOne({
    repoId,
    prNumber,
    status: "skipped_draft",
  });
  return doc !== null;
}

export async function evaluatePullRequestEvent(
  payload: PullRequestEvent,
  deliveryId: string,
): Promise<TriggerOutcome> {
  const { action, repository, pull_request: pr } = payload;
  const installationId = payload.installation?.id;

  const tenant = await resolveTenant(installationId, repository.full_name);
  if (!tenant.ok) return { status: "ignored", reason: tenant.reason };
  const { account, repo } = tenant;

  switch (action) {
    case "review_requested": {
      const reviewerId = payload.requested_reviewer?.id;
      if (reviewerId !== account.githubUserId) {
        return { status: "ignored", reason: "reviewer_mismatch" };
      }
      const result = await enqueueReviewRequest({
        account,
        repo,
        pr,
        deliveryId,
        trigger: "review_requested",
        draftSkip: pr.draft,
      });
      return result;
    }

    case "ready_for_review": {
      if (!(await hasSkippedDraft(repo._id, pr.number))) {
        return { status: "ignored", reason: "no_prior_draft_skip" };
      }
      const result = await enqueueReviewRequest({
        account,
        repo,
        pr,
        deliveryId,
        trigger: "ready_for_review",
        draftSkip: false,
      });
      return result;
    }

    case "synchronize": {
      const flagged = await flagNewerCommits(repo._id, pr.number);
      return flagged
        ? { status: "flagged_newer_commits" }
        : { status: "ignored", reason: "synchronize_no_active_run" };
    }

    case "closed":
      await cancelQueued(repo._id, pr.number, "pr_closed");
      return { status: "cancelled", reason: "pr_closed" };

    case "review_request_removed": {
      if (payload.requested_reviewer?.id !== account.githubUserId) {
        return { status: "ignored", reason: "reviewer_mismatch" };
      }
      await cancelQueued(repo._id, pr.number, "request_removed");
      return { status: "cancelled", reason: "request_removed" };
    }

    default:
      return { status: "ignored", reason: `unhandled_action:${action}` };
  }
}
