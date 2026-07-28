import { ObjectId } from "mongodb";
import {
  reviewRequestsCollection,
  reviewsCollection,
} from "@/lib/db/collections";
import type { ReviewRequestDoc, ReviewKind } from "@/lib/db/types";

export type RetryResult =
  | { ok: true; requestId: string }
  | { ok: false; reason: string };

export async function retryRequest(id: string): Promise<RetryResult> {
  if (!ObjectId.isValid(id)) return { ok: false, reason: "invalid_id" };
  const requests = await reviewRequestsCollection();
  const original = await requests.findOne({ _id: new ObjectId(id) });
  if (!original) return { ok: false, reason: "not_found" };

  const active = await requests.findOne({
    repoId: original.repoId,
    prNumber: original.prNumber,
    status: { $in: ["queued", "processing"] },
  });
  if (active) return { ok: false, reason: "already_active" };

  const reviews = await reviewsCollection();
  const prior = await reviews.findOne({
    repoId: original.repoId,
    prNumber: original.prNumber,
  });
  const kind: ReviewKind = prior ? "re_review" : "initial";

  const now = new Date();
  const doc: ReviewRequestDoc = {
    _id: new ObjectId(),
    deliveryId: `retry-${original._id.toHexString()}-${now.getTime()}`,
    retryOf: original._id,
    userConnectionId: original.userConnectionId,
    installationId: original.installationId,
    repoId: original.repoId,
    prNumber: original.prNumber,
    prTitle: original.prTitle,
    prAuthor: original.prAuthor,
    prUrl: original.prUrl,
    headSha: original.headSha,
    baseSha: original.baseSha,
    kind,
    trigger: "manual_retry",
    status: "queued",
    createdAt: now,
  };

  try {
    await requests.insertOne(doc);
  } catch {
    return { ok: false, reason: "insert_failed" };
  }
  return { ok: true, requestId: doc._id.toHexString() };
}
