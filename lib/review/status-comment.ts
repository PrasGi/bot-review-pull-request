import type { ObjectId } from "mongodb";
import { reposCollection, reviewRequestsCollection } from "@/lib/db/collections";
import type { ReviewRequestDoc } from "@/lib/db/types";
import { getEnv } from "@/lib/env";
import { deleteIssueComment, postIssueComment } from "@/lib/github/pr";
import { getValidAccessToken } from "@/lib/github/tokens";
import { errorFields, log } from "@/lib/logger";
import { buildStatusComment } from "@/lib/review/status-comment-copy";
import { createUrlToken, hashUrlToken } from "@/lib/util/token";

let indexes: Promise<void> | null = null;

function ensureLiveIndexes(): Promise<void> {
  indexes ??= reviewRequestsCollection()
    .then((c) =>
      c.createIndex(
        { liveTokenHash: 1 },
        { name: "liveTokenHash_unique", unique: true, sparse: true },
      ),
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      indexes = null;
      throw error;
    });
  return indexes;
}

export function livePath(token: string): string {
  return `/live/${encodeURIComponent(token)}`;
}

async function repoParts(repoId: ObjectId): Promise<{ owner: string; name: string }> {
  const repo = await (await reposCollection()).findOne({ _id: repoId }, { projection: { fullName: 1 } });
  const [owner, name] = repo?.fullName.split("/") ?? [];
  if (!owner || !name) throw new Error("repo not found");
  return { owner, name };
}

/**
 * Creates the run's public live link and posts the "reviewing" comment with it.
 * Best effort: a failure is logged and the review goes on without a comment.
 */
export async function postStatusComment(request: ReviewRequestDoc): Promise<void> {
  const requestId = request._id.toHexString();
  try {
    await ensureLiveIndexes();
    const requests = await reviewRequestsCollection();
    const token = createUrlToken();
    await requests.updateOne({ _id: request._id }, { $set: { liveTokenHash: hashUrlToken(token) } });

    const { owner, name } = await repoParts(request.repoId);
    const accessToken = await getValidAccessToken(request.userConnectionId);
    const url = new URL(livePath(token), getEnv().APP_URL).toString();
    const { id } = await postIssueComment(accessToken, owner, name, request.prNumber, buildStatusComment(url));
    await requests.updateOne(
      { _id: request._id },
      { $set: { statusComment: { id, postedAt: new Date() } } },
    );
  } catch (error) {
    log.warn("[status-comment] post failed", { requestId, ...errorFields(error) });
  }
}

/**
 * Deletes the run's status comment. Idempotent: the deletion is claimed
 * atomically, so the runner and the failure handler never both delete.
 */
export async function deleteStatusComment(requestId: ObjectId): Promise<void> {
  try {
    const requests = await reviewRequestsCollection();
    const claimed = await requests.findOneAndUpdate(
      { _id: requestId, "statusComment.id": { $exists: true }, "statusComment.deletedAt": { $exists: false } },
      { $set: { "statusComment.deletedAt": new Date() } },
      { returnDocument: "after" },
    );
    if (!claimed?.statusComment) return;

    const { owner, name } = await repoParts(claimed.repoId);
    const accessToken = await getValidAccessToken(claimed.userConnectionId);
    await deleteIssueComment(accessToken, owner, name, claimed.statusComment.id);
  } catch (error) {
    log.warn("[status-comment] delete failed", { requestId: requestId.toHexString(), ...errorFields(error) });
  }
}
