import { describe, expect, it } from "vitest";
import type { ReviewProgress } from "@/lib/db/types";
import {
  chunkCounts,
  formatElapsed,
  isStalled,
  progressPercent,
  progressSteps,
  stepperItems,
} from "@/lib/review/progress";
import { LIVE_COPY } from "@/lib/review/progress-copy";

const t = new Date("2026-09-28T00:00:00Z");

function progress(overrides: Partial<ReviewProgress>): ReviewProgress {
  return { stage: "preparing", stageStartedAt: t, updatedAt: t, ...overrides };
}

const chunks = (c: Partial<NonNullable<ReviewProgress["chunks"]>>) => ({
  total: 12,
  done: 0,
  failed: 0,
  running: 0,
  repairs: 0,
  unreviewedFiles: 0,
  ...c,
});

describe("progressSteps", () => {
  it("is unknown until the path is known", () => {
    expect(progressSteps(undefined)).toBeNull();
    expect(progressSteps(progress({ stage: "fetching_files" }))).toBeNull();
  });

  it("counts one step per chunk on the full path", () => {
    // 4 fixed + prompts + 12 chunks + finalize + post + save = 20
    const building = progress({ stage: "building_prompts", path: "full", chunks: chunks({}) });
    expect(progressSteps(building)).toEqual({ done: 4, total: 20 });

    const reviewing = progress({ stage: "reviewing", path: "full", chunks: chunks({ done: 3, failed: 1, running: 4 }) });
    expect(progressSteps(reviewing)).toEqual({ done: 9, total: 20 });

    const posting = progress({ stage: "posting", path: "full", chunks: chunks({ done: 11, failed: 1 }) });
    expect(progressSteps(posting)).toEqual({ done: 18, total: 20 });
  });

  it("never counts more chunks than exist", () => {
    const p = progress({ stage: "reviewing", path: "full", chunks: chunks({ total: 2, done: 3 }) });
    expect(progressSteps(p)).toEqual({ done: 7, total: 10 });
  });

  it("uses the short reply and empty paths", () => {
    expect(progressSteps(progress({ stage: "evaluating_replies", path: "reply" }))).toEqual({ done: 4, total: 7 });
    expect(progressSteps(progress({ stage: "saving", path: "empty" }))).toEqual({ done: 5, total: 6 });
  });

  it("is complete only once the request finished", () => {
    const saving = progress({ stage: "saving", path: "empty" });
    expect(progressPercent(progressSteps(saving)!)).toBe(83);
    expect(progressSteps(saving, true)).toEqual({ done: 6, total: 6 });
    expect(progressPercent({ done: 19, total: 20 })).toBe(95);
    expect(progressPercent({ done: 20, total: 20 })).toBe(100);
    expect(progressPercent({ done: 0, total: 0 })).toBe(0);
  });
});

describe("stepperItems", () => {
  it("shows only the fixed steps before the path is known", () => {
    expect(stepperItems(progress({ stage: "fetching_pr" })).map((s) => [s.label, s.state])).toEqual([
      ["Prepare", "done"],
      ["Pull request", "current"],
      ["Changed files", "pending"],
      ["Filter", "pending"],
    ]);
  });

  it("marks everything done when finished", () => {
    const items = stepperItems(progress({ stage: "saving", path: "reply" }), true);
    expect(items.map((s) => s.label)).toEqual(["Prepare", "Pull request", "Changed files", "Filter", "Replies", "Post", "Save"]);
    expect(items.every((s) => s.state === "done")).toBe(true);
  });
});

describe("chunk counts and labels", () => {
  it("derives waiting chunks and never goes negative", () => {
    expect(chunkCounts(chunks({ done: 3, failed: 1, running: 4 }))).toEqual({
      total: 12,
      done: 3,
      failed: 1,
      running: 4,
      waiting: 4,
    });
    expect(chunkCounts(chunks({ total: 1, running: -1 }))).toMatchObject({ running: 0, waiting: 1 });
  });

  it("describes chunk progress plainly", () => {
    expect(LIVE_COPY.chunks({ total: 12, done: 3, failed: 1, running: 4, waiting: 4 })).toBe(
      "3 done · 4 reviewing · 4 waiting · 1 failed of 12 chunks",
    );
    expect(LIVE_COPY.chunks({ total: 1, done: 0, failed: 0, running: 1, waiting: 0 })).toBe(
      "0 done · 1 reviewing · 0 waiting of 1 chunk",
    );
    expect(LIVE_COPY.steps(9, 20, 45)).toBe("9 of 20 steps · 45%");
  });
});

describe("time helpers", () => {
  it("formats elapsed time", () => {
    expect(formatElapsed(42_300)).toBe("42s");
    expect(formatElapsed(102_000)).toBe("1m 42s");
    expect(formatElapsed(3_780_000)).toBe("1h 3m");
    expect(formatElapsed(-5)).toBe("0s");
  });

  it("flags a run whose heartbeat is older than 90s", () => {
    expect(isStalled(new Date(t.getTime() - 91_000), t)).toBe(true);
    expect(isStalled(new Date(t.getTime() - 60_000), t)).toBe(false);
    expect(isStalled(undefined, t)).toBe(false);
  });
});
