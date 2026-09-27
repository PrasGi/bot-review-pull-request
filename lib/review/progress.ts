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

function chunkTotal(progress: ReviewProgress): number {
  return progress.path === "full" ? (progress.chunks?.total ?? 0) : 0;
}

/**
 * Completed steps out of the total. "reviewing" counts one step per chunk, and a
 * failed chunk is a finished step. Null until the path (and so the total) is known.
 */
export function progressSteps(
  progress: ReviewProgress | undefined,
  finished = false,
): { done: number; total: number } | null {
  if (!progress?.path) return null;
  const stages = pathStages(progress.path);
  const chunks = chunkTotal(progress);
  const weight = (stage: ReviewStage): number => (stage === "reviewing" ? chunks : 1);
  const total = stages.reduce((sum, stage) => sum + weight(stage), 0);
  if (finished) return { done: total, total };

  const current = stages.indexOf(progress.stage);
  let done = stages.slice(0, Math.max(current, 0)).reduce((sum, stage) => sum + weight(stage), 0);
  if (progress.stage === "reviewing") {
    done += Math.min(chunks, (progress.chunks?.done ?? 0) + (progress.chunks?.failed ?? 0));
  }
  return { done, total };
}

/** Rounded down, so the bar reaches 100% only when the run is really finished. */
export function progressPercent(steps: { done: number; total: number }): number {
  if (steps.total <= 0) return 0;
  return Math.floor((steps.done / steps.total) * 100);
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
