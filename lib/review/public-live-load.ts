import { reposCollection, reviewRequestsCollection, reviewsCollection } from "@/lib/db/collections";
import { isLiveLinkExpired, toPublicLive, type PublicLive } from "@/lib/review/public-live";
import { hashUrlToken, urlTokenSchema } from "@/lib/util/token";

export type PublicLiveResult =
  | { kind: "ok"; live: PublicLive }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "expired" };

/** Resolves a live link token. Malformed tokens never reach the database. */
export async function loadPublicLive(token: string, now: Date = new Date()): Promise<PublicLiveResult> {
  if (!urlTokenSchema.safeParse(token).success) return { kind: "invalid" };

  const requests = await reviewRequestsCollection();
  const doc = await requests.findOne({ liveTokenHash: hashUrlToken(token) });
  if (!doc) return { kind: "not_found" };
  if (isLiveLinkExpired(doc, now)) return { kind: "expired" };

  const [repo, review] = await Promise.all([
    reposCollection().then((c) => c.findOne({ _id: doc.repoId }, { projection: { fullName: 1 } })),
    doc.status === "completed"
      ? reviewsCollection().then((c) =>
          c.findOne({ requestId: doc._id }, { projection: { verdict: 1, findings: 1 } }),
        )
      : Promise.resolve(null),
  ]);

  return {
    kind: "ok",
    live: toPublicLive(
      doc,
      repo?.fullName ?? "unknown",
      review ? { verdict: review.verdict, findings: review.findings.length } : null,
      now,
    ),
  };
}
