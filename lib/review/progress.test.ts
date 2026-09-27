import { describe, expect, it } from "vitest";
import type { ReviewProgress } from "@/lib/db/types";
import {
  chunkCounts,
  chunkPercent,
  formatElapsed,
  isStalled,
  oldestRunningChunk,
  SLOW_CHUNK_MS,
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

describe("chunkPercent", () => {
  it("has no bar before the chunk stage or on paths without chunks", () => {
    expect(chunkPercent(undefined)).toBeNull();
    expect(chunkPercent(progress({ stage: "fetching_files" }))).toBeNull();
    expect(chunkPercent(progress({ stage: "building_prompts", path: "full", chunks: chunks({}) }))).toBeNull();
    expect(chunkPercent(progress({ stage: "evaluating_replies", path: "reply" }))).toBeNull();
    expect(chunkPercent(progress({ stage: "saving", path: "empty" }), true)).toBeNull();
  });

  it("counts settled chunks, failed ones included, rounded down", () => {
    const reviewing = (c: Parameters<typeof chunks>[0]) => progress({ stage: "reviewing", path: "full", chunks: chunks(c) });
    expect(chunkPercent(reviewing({}))).toBe(0);
    expect(chunkPercent(reviewing({ done: 3, failed: 1, running: 4 }))).toBe(33);
    expect(chunkPercent(reviewing({ done: 11 }))).toBe(91);
    expect(chunkPercent(reviewing({ total: 2, done: 3 }))).toBe(100);
  });

  it("is full once the review moves past the chunks", () => {
    expect(chunkPercent(progress({ stage: "posting", path: "full", chunks: chunks({ done: 11, failed: 1 }) }))).toBe(100);
    expect(chunkPercent(progress({ stage: "reviewing", path: "full", chunks: chunks({}) }), true)).toBe(100);
  });
});

describe("oldestRunningChunk", () => {
  it("returns the longest-running chunk with its 1-based number", () => {
    const early = new Date(t.getTime() - SLOW_CHUNK_MS - 1_000);
    expect(
      oldestRunningChunk(chunks({ startedAt: { "0": new Date(t.getTime() - 5_000), "3": early } })),
    ).toEqual({ number: 4, startedAt: early });
    expect(oldestRunningChunk(chunks({}))).toBeNull();
    expect(oldestRunningChunk(undefined)).toBeNull();
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
    expect(LIVE_COPY.chunkBar(3, 8, 37)).toBe("3 of 8 chunks · 37%");
    expect(LIVE_COPY.chunkBar(0, 1, 0)).toBe("0 of 1 chunk · 0%");
  });

  it("marks the result with the verdict's own glyph", () => {
    expect(LIVE_COPY.result.completed("APPROVE", 0, "40s")).toBe("✓ APPROVE · 0 findings · 40s");
    expect(LIVE_COPY.result.completed("REQUEST_CHANGES", 3, "47s")).toBe("✕ REQUEST_CHANGES · 3 findings · 47s");
    expect(LIVE_COPY.result.completed("COMMENT", 1, "1m 2s")).toBe("! COMMENT · 1 finding · 1m 2s");
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
