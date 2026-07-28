import { reviewRequestsCollection } from "@/lib/db/collections";
import { resolveRepo, resolveReviewTenant } from "@/lib/webhook/tenant";
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
  const reviewerId = payload.requested_reviewer?.id;

  switch (action) {
    case "review_requested": {
      const tenant = await resolveReviewTenant(
        installationId,
        repository.full_name,
        reviewerId,
      );
      if (!tenant.ok) return { status: "ignored", reason: tenant.reason };
      return enqueueReviewRequest({
        installation: tenant.installation,
        reviewer: tenant.reviewer,
        repo: tenant.repo,
        pr,
        deliveryId,
        trigger: "review_requested",
        draftSkip: pr.draft,
      });
    }

    case "ready_for_review": {
      const tenant = await resolveReviewTenant(
        installationId,
        repository.full_name,
        reviewerId,
      );
      if (!tenant.ok) return { status: "ignored", reason: tenant.reason };
      if (!(await hasSkippedDraft(tenant.repo._id, pr.number))) {
        return { status: "ignored", reason: "no_prior_draft_skip" };
      }
      return enqueueReviewRequest({
        installation: tenant.installation,
        reviewer: tenant.reviewer,
        repo: tenant.repo,
        pr,
        deliveryId,
        trigger: "ready_for_review",
        draftSkip: false,
      });
    }

    case "synchronize": {
      const repoResult = await resolveRepo(installationId, repository.full_name);
      if (!repoResult.ok) {
        return { status: "ignored", reason: repoResult.reason };
      }
      const flagged = await flagNewerCommits(repoResult.repo._id, pr.number);
      return flagged
        ? { status: "flagged_newer_commits" }
        : { status: "ignored", reason: "synchronize_no_active_run" };
    }

    case "closed": {
      const repoResult = await resolveRepo(installationId, repository.full_name);
      if (!repoResult.ok) {
        return { status: "ignored", reason: repoResult.reason };
      }
      await cancelQueued(repoResult.repo._id, pr.number, "pr_closed");
      return { status: "cancelled", reason: "pr_closed" };
    }

    case "review_request_removed": {
      const tenant = await resolveReviewTenant(
        installationId,
        repository.full_name,
        reviewerId,
      );
      if (!tenant.ok) return { status: "ignored", reason: tenant.reason };
      await cancelQueued(tenant.repo._id, pr.number, "request_removed");
      return { status: "cancelled", reason: "request_removed" };
    }

    default:
      return { status: "ignored", reason: `unhandled_action:${action}` };
  }
}
