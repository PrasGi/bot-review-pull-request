import type { ObjectId } from "mongodb";
import { reviewRequestsCollection } from "@/lib/db/collections";
import type { ReviewProgress, ReviewStage } from "@/lib/db/types";
import { errorFields, log } from "@/lib/logger";

type StageExtra = Partial<Omit<ReviewProgress, "stage" | "stageStartedAt" | "updatedAt">>;

export interface ProgressReporter {
  stage(stage: ReviewStage, extra?: StageExtra): Promise<void>;
  chunkStarted(index: number): Promise<void>;
  chunkFinished(index: number, ok: boolean): Promise<void>;
  chunkRepaired(): Promise<void>;
}

export const NOOP_PROGRESS: ProgressReporter = {
  stage: async () => {},
  chunkStarted: async () => {},
  chunkFinished: async () => {},
  chunkRepaired: async () => {},
};

/**
 * Writes live progress onto the request. Chunk counters use $inc so parallel
 * chunks never overwrite each other. A failed write is logged and ignored:
 * progress must never fail a review.
 */
export function createProgressReporter(requestId: ObjectId): ProgressReporter {
  const write = async (update: Record<string, unknown>): Promise<void> => {
    try {
      const requests = await reviewRequestsCollection();
      await requests.updateOne({ _id: requestId, status: "processing" }, update);
    } catch (error) {
      log.warn("review.progress.write_failed", {
        requestId: requestId.toHexString(),
        ...errorFields(error),
      });
    }
  };

  return {
    stage: (stage, extra = {}) => {
      const now = new Date();
      const set: Record<string, unknown> = {
        "progress.stage": stage,
        "progress.stageStartedAt": now,
        "progress.updatedAt": now,
      };
      for (const [key, value] of Object.entries(extra)) {
        if (value !== undefined) set[`progress.${key}`] = value;
      }
      return write({ $set: set });
    },
    chunkStarted: (index) => {
      const now = new Date();
      return write({
        $inc: { "progress.chunks.running": 1 },
        $set: { [`progress.chunks.startedAt.${index}`]: now, "progress.updatedAt": now },
      });
    },
    chunkFinished: (index, ok) => {
      const now = new Date();
      return write({
        $inc: { "progress.chunks.running": -1, [ok ? "progress.chunks.done" : "progress.chunks.failed"]: 1 },
        $set: {
          [`progress.chunks.finished.${index}`]: ok ? "done" : "failed",
          "progress.chunks.lastFinishedAt": now,
          "progress.updatedAt": now,
        },
        $unset: { [`progress.chunks.startedAt.${index}`]: "" },
      });
    },
    chunkRepaired: () =>
      write({ $inc: { "progress.chunks.repairs": 1 }, $set: { "progress.updatedAt": new Date() } }),
  };
}
