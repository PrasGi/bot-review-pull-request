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
  isStalled,
  progressPercent,
  progressSteps,
  stepperItems,
  type StepState,
} from "@/lib/review/progress";
import { STAGE_LABEL, LIVE_COPY } from "@/lib/review/progress-copy";

/** A focused request stays on screen this long after it finishes, so its result can show. */
export const FINISHED_WINDOW_MS = 15_000;

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
  steps: { done: number; total: number } | null;
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
  heartbeatAt: string | null;
  stalled: boolean;
  result: { verdict: Verdict; findings: number } | null;
  error: string | null;
  cancelReason: string | null;
}

export interface LiveResponse {
  focus: LiveRequest | null;
  othersRunning: number;
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
  const steps = progressSteps(progress, finished);
  const chunks = progress?.chunks;
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
    steps,
    percent: steps ? progressPercent(steps) : null,
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
  if (!focus) return { focus: null, othersRunning: 0 };

  const [repo, review] = await Promise.all([
    reposCollection().then((c) => c.findOne({ _id: focus.repoId }, { projection: { fullName: 1 } })),
    focus.status === "completed"
      ? reviewsCollection().then((c) =>
          c.findOne({ requestId: focus._id }, { projection: { verdict: 1, findings: 1 } }),
        )
      : Promise.resolve(null),
  ]);

  return {
    focus: toLiveRequest(
      focus,
      repo?.fullName ?? "unknown",
      review ? { verdict: review.verdict, findings: review.findings.length } : null,
      now,
    ),
    othersRunning: active.filter((r) => !r._id.equals(focus._id)).length,
  };
}
