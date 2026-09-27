import type {
  ReviewPath,
  ReviewProgress,
  ReviewProgressChunks,
  ReviewStage,
} from "@/lib/db/types";
import { STEP_LABEL } from "@/lib/review/progress-copy";

// Client-safe and pure: the dashboard derives every number from the stored
// progress, and nothing here estimates time.

const FIXED: ReviewStage[] = ["preparing", "fetching_pr", "fetching_files", "filtering"];

const TAIL: Record<ReviewPath, ReviewStage[]> = {
  full: ["building_prompts", "reviewing", "finalizing", "posting", "saving"],
  reply: ["evaluating_replies", "posting", "saving"],
  empty: ["posting", "saving"],
};

/** The heartbeat ticks every 60 s, so a gap past this means the run is stuck. */
export const STALLED_AFTER_MS = 90_000;

export function pathStages(path: ReviewPath | undefined): ReviewStage[] {
  return path ? [...FIXED, ...TAIL[path]] : FIXED;
}

const AFTER_REVIEW: ReviewStage[] = ["finalizing", "posting", "saving"];

/**
 * The bar tracks chunk reviews only: the step that takes the time. Null when the
 * run has no chunk stage (reply or empty path) or has not reached it yet.
 */
export function chunkPercent(progress: ReviewProgress | undefined, finished = false): number | null {
  if (progress?.path !== "full") return null;
  if (finished || AFTER_REVIEW.includes(progress.stage)) return 100;
  if (progress.stage !== "reviewing" || !progress.chunks || progress.chunks.total <= 0) return null;
  const settled = Math.min(progress.chunks.total, progress.chunks.done + progress.chunks.failed);
  // Rounded down, so 100% only once every chunk has settled.
  return Math.floor((settled / progress.chunks.total) * 100);
}

/** GLM chunk calls measured p95 216 s; past this a running chunk is slower than usual. */
export const SLOW_CHUNK_MS = 240_000;

/** The chunk that has been running longest, with its 1-based number. */
export function oldestRunningChunk(
  chunks: ReviewProgressChunks | undefined,
): { number: number; startedAt: Date } | null {
  let oldest: { number: number; startedAt: Date } | null = null;
  for (const [index, startedAt] of Object.entries(chunks?.startedAt ?? {})) {
    const at = new Date(startedAt);
    if (!oldest || at < oldest.startedAt) oldest = { number: Number(index) + 1, startedAt: at };
  }
  return oldest;
}

export type StepState = "done" | "current" | "pending";

export function stepperItems(
  progress: ReviewProgress | undefined,
  finished = false,
): { stage: ReviewStage; label: string; state: StepState }[] {
  const stages = pathStages(progress?.path);
  const current = progress ? stages.indexOf(progress.stage) : -1;
  return stages.map((stage, index) => ({
    stage,
    label: STEP_LABEL[stage],
    state: finished || index < current ? "done" : index === current ? "current" : "pending",
  }));
}

export function chunkCounts(chunks: ReviewProgressChunks): {
  total: number;
  done: number;
  failed: number;
  running: number;
  waiting: number;
} {
  const running = Math.max(0, chunks.running);
  return {
    total: chunks.total,
    done: chunks.done,
    failed: chunks.failed,
    running,
    waiting: Math.max(0, chunks.total - chunks.done - chunks.failed - running),
  };
}

export function isStalled(heartbeatAt: Date | undefined, now: Date = new Date()): boolean {
  return heartbeatAt !== undefined && now.getTime() - heartbeatAt.getTime() > STALLED_AFTER_MS;
}

/** "42s", "1m 42s", "1h 3m". Elapsed time only; nothing here predicts the rest. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
