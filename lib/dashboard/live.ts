import type { ObjectId } from "mongodb";
import {
  reposCollection,
  reviewRequestsCollection,
  reviewsCollection,
} from "@/lib/db/collections";
import type {
  ReviewPath,
  ReviewRequestDoc,
  ReviewRequestStatus,
  ReviewStage,
  Verdict,
} from "@/lib/db/types";
import {
  chunkCounts,
  chunkPercent,
  isStalled,
  oldestRunningChunk,
  SLOW_CHUNK_MS,
  stepperItems,
  type StepState,
} from "@/lib/review/progress";
import { STAGE_LABEL, LIVE_COPY } from "@/lib/review/progress-copy";

/**
 * How long a finished focus is still returned. The client shows the result for
 * 60 s; the margin covers a poll landing late.
 */
export const FINISHED_WINDOW_MS = 75_000;

const ACTIVE: ReviewRequestStatus[] = ["processing", "queued"];
const FINISHED: ReviewRequestStatus[] = ["completed", "failed", "cancelled", "skipped_draft", "superseded"];

export interface LiveRequest {
  id: string;
  repoFullName: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  kind: ReviewRequestDoc["kind"];
  status: ReviewRequestStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  stage: ReviewStage | null;
  path: ReviewPath | null;
  label: string;
  stageStartedAt: string | null;
  /** Chunk review progress only; null outside the chunk stage of a full review. */
  percent: number | null;
  stepper: { stage: ReviewStage; label: string; state: StepState }[];
  files: { changed: number; kept: number; skipped: number } | null;
  chunks: {
    total: number;
    done: number;
    failed: number;
    running: number;
    waiting: number;
    repairs: number;
    unreviewedFiles: number;
    lastFinishedAt: string | null;
  } | null;
  oldestChunk: { number: number; startedAt: string } | null;
  slowChunk: boolean;
  heartbeatAt: string | null;
  stalled: boolean;
  result: { verdict: Verdict; findings: number } | null;
  error: string | null;
  cancelReason: string | null;
}

export interface LiveOther {
  id: string;
  repoFullName: string;
  prNumber: number;
  label: string;
}

export interface LiveResponse {
  focus: LiveRequest | null;
  othersRunning: number;
  /** The other active reviews, so the page can switch focus to one of them. */
  others: LiveOther[];
}

/** Oldest running first, then oldest queued: "the first request". */
export function orderActive(requests: ReviewRequestDoc[]): ReviewRequestDoc[] {
  const rank = (r: ReviewRequestDoc): number => (r.status === "processing" ? 0 : 1);
  const time = (r: ReviewRequestDoc): number => (r.startedAt ?? r.createdAt).getTime();
  return [...requests].sort((a, b) => rank(a) - rank(b) || time(a) - time(b));
}

/** Keeps the client's focus while it is active or just finished; otherwise the first active one. */
export function pickFocus(
  active: ReviewRequestDoc[],
  requested: ReviewRequestDoc | null,
  now: Date = new Date(),
): ReviewRequestDoc | null {
  if (requested) {
    if (ACTIVE.includes(requested.status)) return requested;
    const finishedAt = requested.finishedAt?.getTime();
    if (
      FINISHED.includes(requested.status) &&
      finishedAt !== undefined &&
      now.getTime() - finishedAt <= FINISHED_WINDOW_MS
    ) {
      return requested;
    }
  }
  return orderActive(active)[0] ?? null;
}

const iso = (d: Date | undefined): string | null => (d ? d.toISOString() : null);

export function toLiveRequest(
  doc: ReviewRequestDoc,
  repoFullName: string,
  review: { verdict: Verdict; findings: number } | null,
  now: Date = new Date(),
): LiveRequest {
  const progress = doc.progress;
  const finished = doc.status === "completed";
  const chunks = progress?.chunks;
  const oldest = progress?.stage === "reviewing" ? oldestRunningChunk(chunks) : null;
  return {
    id: doc._id.toHexString(),
    repoFullName,
    prNumber: doc.prNumber,
    prTitle: doc.prTitle,
    prUrl: doc.prUrl,
    kind: doc.kind,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    startedAt: iso(doc.startedAt),
    finishedAt: iso(doc.finishedAt),
    stage: progress?.stage ?? null,
    path: progress?.path ?? null,
    label:
      doc.status === "queued" ? LIVE_COPY.queued : progress ? STAGE_LABEL[progress.stage] : STAGE_LABEL.preparing,
    stageStartedAt: iso(progress?.stageStartedAt),
    percent: chunkPercent(progress, finished),
    stepper: stepperItems(progress, finished),
    files: progress?.files ?? null,
    chunks: chunks
      ? {
          ...chunkCounts(chunks),
          repairs: chunks.repairs,
          unreviewedFiles: chunks.unreviewedFiles,
          lastFinishedAt: iso(chunks.lastFinishedAt),
        }
      : null,
    oldestChunk: oldest ? { number: oldest.number, startedAt: oldest.startedAt.toISOString() } : null,
    slowChunk:
      doc.status === "processing" && oldest !== null && now.getTime() - oldest.startedAt.getTime() > SLOW_CHUNK_MS,
    heartbeatAt: iso(doc.heartbeatAt),
    stalled: doc.status === "processing" && isStalled(doc.heartbeatAt, now),
    result: review,
    error: doc.error?.message ?? null,
    cancelReason: doc.cancelReason ?? null,
  };
}

export async function getLiveReview(
  focusId: ObjectId | null,
  now: Date = new Date(),
): Promise<LiveResponse> {
  const requests = await reviewRequestsCollection();
  const [active, requested] = await Promise.all([
    requests.find({ status: { $in: ACTIVE } }).toArray(),
    focusId ? requests.findOne({ _id: focusId }) : Promise.resolve(null),
  ]);

  const focus = pickFocus(active, requested, now);
  if (!focus) return { focus: null, othersRunning: 0, others: [] };

  const others = orderActive(active).filter((r) => !r._id.equals(focus._id));
  const repoIds = [focus.repoId, ...others.map((r) => r.repoId)];
  const [repoDocs, review] = await Promise.all([
    reposCollection().then((c) =>
      c.find({ _id: { $in: repoIds } }, { projection: { fullName: 1 } }).toArray(),
    ),
    focus.status === "completed"
      ? reviewsCollection().then((c) =>
          c.findOne({ requestId: focus._id }, { projection: { verdict: 1, findings: 1 } }),
        )
      : Promise.resolve(null),
  ]);

  const nameById = new Map(repoDocs.map((r) => [r._id.toHexString(), r.fullName]));
  const repoName = (id: ObjectId): string => nameById.get(id.toHexString()) ?? "unknown";

  return {
    focus: toLiveRequest(
      focus,
      repoName(focus.repoId),
      review ? { verdict: review.verdict, findings: review.findings.length } : null,
      now,
    ),
    othersRunning: others.length,
    others: others.map((r) => ({
      id: r._id.toHexString(),
      repoFullName: repoName(r.repoId),
      prNumber: r.prNumber,
      label: r.status === "queued" ? LIVE_COPY.queued : STAGE_LABEL[r.progress?.stage ?? "preparing"],
    })),
  };
}
