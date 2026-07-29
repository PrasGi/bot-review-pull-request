import { ObjectId } from "mongodb";
import {
  reviewRequestsCollection,
  reviewsCollection,
  reposCollection,
} from "@/lib/db/collections";
import type {
  InstallationDoc,
  RepoDoc,
  ReviewKind,
  ReviewRequestDoc,
  ReviewTrigger,
  UserConnectionDoc,
} from "@/lib/db/types";
import type { WebhookPullRequest } from "@/lib/webhook/payloads";

const DUPLICATE_KEY = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === DUPLICATE_KEY
  );
}

async function resolveKind(
  repoId: ObjectId,
  prNumber: number,
): Promise<ReviewKind> {
  const reviews = await reviewsCollection();
  const prior = await reviews.findOne({ repoId, prNumber });
  return prior ? "re_review" : "initial";
}

async function touchRepoLastEvent(repoId: ObjectId, at: Date): Promise<void> {
  const repos = await reposCollection();
  await repos.updateOne({ _id: repoId }, { $set: { lastEventAt: at } });
}

export type EnqueueResult =
  | { status: "queued"; requestId: ObjectId }
  | { status: "superseded" }
  | { status: "skipped_draft"; requestId: ObjectId };

export async function enqueueReviewRequest(params: {
  installation: InstallationDoc;
  reviewer: UserConnectionDoc;
  repo: RepoDoc;
  pr: WebhookPullRequest;
  deliveryId: string;
  trigger: ReviewTrigger;
  draftSkip: boolean;
}): Promise<EnqueueResult> {
  const { installation, reviewer, repo, pr, deliveryId, trigger, draftSkip } =
    params;
  const requests = await reviewRequestsCollection();
  const now = new Date();
  await touchRepoLastEvent(repo._id, now);

  const base = {
    deliveryId,
    userConnectionId: reviewer._id,
    installationId: installation.installationId,
    repoId: repo._id,
    prNumber: pr.number,
    prTitle: pr.title,
    prAuthor: pr.user.login,
    prUrl: pr.html_url,
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
    trigger,
    createdAt: now,
  } satisfies Partial<ReviewRequestDoc>;

  if (draftSkip) {
    const doc: ReviewRequestDoc = {
      _id: new ObjectId(),
      ...base,
      kind: "initial",
      status: "skipped_draft",
    };
    await requests.insertOne(doc);
    return { status: "skipped_draft", requestId: doc._id };
  }

  const kind = await resolveKind(repo._id, pr.number);
  const doc: ReviewRequestDoc = {
    _id: new ObjectId(),
    ...base,
    kind,
    status: "queued",
  };

  try {
    await requests.insertOne(doc);
    return { status: "queued", requestId: doc._id };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      await requests.updateOne(
        {
          repoId: repo._id,
          prNumber: pr.number,
          status: { $in: ["queued", "processing"] },
        },
        { $set: { reReviewRequestedFlag: true } },
      );
      return { status: "superseded" };
    }
    throw error;
  }
}
