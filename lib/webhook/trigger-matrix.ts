import {
  reviewRequestsCollection,
  userConnectionsCollection,
} from "@/lib/db/collections";
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

/** Reviewers whose request was skipped while the PR was a draft, newest first. */
async function skippedDraftReviewerIds(
  repoId: ObjectId,
  prNumber: number,
): Promise<ObjectId[]> {
  const requests = await reviewRequestsCollection();
  const docs = await requests
    .find(
      {
        repoId,
        prNumber,
        status: "skipped_draft",
        draftResumedAt: { $exists: false },
      },
      { projection: { userConnectionId: 1 } },
    )
    .sort({ createdAt: -1 })
    .toArray();
  const seen = new Set<string>();
  const ids: ObjectId[] = [];
  for (const doc of docs) {
    const key = doc.userConnectionId.toHexString();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(doc.userConnectionId);
  }
  return ids;
}

/** A draft skip resumes once: going back to draft and ready again needs a new request. */
async function markDraftSkipsResumed(
  repoId: ObjectId,
  prNumber: number,
): Promise<void> {
  const requests = await reviewRequestsCollection();
  await requests.updateMany(
    {
      repoId,
      prNumber,
      status: "skipped_draft",
      draftResumedAt: { $exists: false },
    },
    { $set: { draftResumedAt: new Date() } },
  );
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
      // GitHub sends no requested_reviewer on ready_for_review, so the reviewer
      // comes from the request that was skipped while the PR was a draft.
      const repoResult = await resolveRepo(installationId, repository.full_name);
      if (!repoResult.ok) {
        return { status: "ignored", reason: repoResult.reason };
      }
      const skippedFor = await skippedDraftReviewerIds(
        repoResult.repo._id,
        pr.number,
      );
      if (skippedFor.length === 0) {
        return { status: "ignored", reason: "no_prior_draft_skip" };
      }

      const stillRequested = pr.requested_reviewers
        ? new Set(pr.requested_reviewers.map((u) => u.id))
        : null;
      const connections = await userConnectionsCollection();
      let reason = "reviewer_not_connected";
      for (const connectionId of skippedFor) {
        const connection = await connections.findOne({ _id: connectionId });
        if (!connection) continue;
        if (stillRequested && !stillRequested.has(connection.githubUserId)) {
          reason = "reviewer_no_longer_requested";
          continue;
        }
        const tenant = await resolveReviewTenant(
          installationId,
          repository.full_name,
          connection.githubUserId,
        );
        if (!tenant.ok) {
          reason = tenant.reason;
          continue;
        }
        const outcome = await enqueueReviewRequest({
          installation: tenant.installation,
          reviewer: tenant.reviewer,
          repo: tenant.repo,
          pr,
          deliveryId,
          trigger: "ready_for_review",
          draftSkip: false,
        });
        await markDraftSkipsResumed(repoResult.repo._id, pr.number);
        return outcome;
      }
      return { status: "ignored", reason };
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
