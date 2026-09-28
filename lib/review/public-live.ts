import type { ReviewRequestDoc, Verdict } from "@/lib/db/types";
import { PROVIDER_LABEL } from "@/lib/ai/provider-labels";
import { toLiveRequest, type LiveRequest } from "@/lib/dashboard/live";
import { PROFILE_META } from "@/lib/prompts/profile-meta";
import { PUBLIC_LIVE_COPY } from "@/lib/review/progress-copy";

/** A live link keeps working this long after its run finishes. */
export const LIVE_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export type ChunkState = "waiting" | "running" | "done" | "failed";

export interface PublicChunkRow {
  number: number;
  files: string[];
  state: ChunkState;
  startedAt: string | null;
}

/**
 * What the public live page may show. No ids, costs or raw error text: the
 * link is a bearer token that anyone on the PR can open.
 */
export type PublicLive = Omit<LiveRequest, "id" | "error"> & {
  error: string | null;
  chunkRows: PublicChunkRow[];
  model: { providerLabel: string; model: string } | null;
  character: { label: string; description: string } | null;
};

export function isLiveLinkExpired(doc: Pick<ReviewRequestDoc, "finishedAt">, now: Date = new Date()): boolean {
  return doc.finishedAt !== undefined && now.getTime() - doc.finishedAt.getTime() > LIVE_LINK_TTL_MS;
}

export function chunkRows(doc: ReviewRequestDoc): PublicChunkRow[] {
  const progress = doc.progress;
  const finished = progress?.chunks?.finished ?? {};
  const startedAt = progress?.chunks?.startedAt ?? {};
  return (progress?.chunkFiles ?? []).map((files, index): PublicChunkRow => {
    const key = String(index);
    const end = finished[key] as "done" | "failed" | undefined;
    const start = startedAt[key] as Date | undefined;
    if (end) return { number: index + 1, files, state: end, startedAt: null };
    if (start) return { number: index + 1, files, state: "running", startedAt: new Date(start).toISOString() };
    return { number: index + 1, files, state: "waiting", startedAt: null };
  });
}

export function toPublicLive(
  doc: ReviewRequestDoc,
  repoFullName: string,
  review: { verdict: Verdict; findings: number } | null,
  now: Date = new Date(),
): PublicLive {
  const full: Partial<LiveRequest> = { ...toLiveRequest(doc, repoFullName, review, now) };
  const error = full.error;
  // The request id stays private: the token is the only handle this page gets.
  delete full.id;
  delete full.error;
  const live = full as Omit<LiveRequest, "id" | "error">;
  const model = doc.progress?.model;
  const profile = doc.progress?.profile;
  return {
    ...live,
    error: error ? PUBLIC_LIVE_COPY.failed : null,
    chunkRows: chunkRows(doc),
    model: model ? { providerLabel: PROVIDER_LABEL[model.provider], model: model.model } : null,
    character: profile
      ? { label: PROFILE_META[profile].label, description: PROFILE_META[profile].description }
      : null,
  };
}
