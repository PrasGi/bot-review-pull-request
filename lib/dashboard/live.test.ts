import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import type { ReviewRequestDoc } from "@/lib/db/types";
import { FINISHED_WINDOW_MS, orderActive, pickFocus, toLiveRequest } from "@/lib/dashboard/live";

const now = new Date("2026-09-28T10:00:00Z");
const ago = (ms: number): Date => new Date(now.getTime() - ms);

function request(overrides: Partial<ReviewRequestDoc>): ReviewRequestDoc {
  return {
    _id: new ObjectId(),
    deliveryId: "d",
    userConnectionId: new ObjectId(),
    installationId: 1,
    repoId: new ObjectId(),
    prNumber: 7,
    prTitle: "Add invites",
    prAuthor: "a",
    prUrl: "https://github.com/o/r/pull/7",
    headSha: "abc",
    baseSha: "def",
    kind: "initial",
    trigger: "review_requested",
    status: "processing",
    createdAt: ago(120_000),
    ...overrides,
  };
}

describe("orderActive / pickFocus", () => {
  const older = request({ startedAt: ago(90_000) });
  const newer = request({ startedAt: ago(10_000) });
  const queued = request({ status: "queued", createdAt: ago(300_000) });

  it("puts the oldest running review first, queued after running", () => {
    expect(orderActive([queued, newer, older]).map((r) => r._id)).toEqual([older._id, newer._id, queued._id]);
  });

  it("keeps the requested focus while it runs", () => {
    expect(pickFocus([older, newer], newer, now)).toBe(newer);
  });

  it("keeps a just-finished focus for the result window, then moves on", () => {
    const done = request({ status: "completed", finishedAt: ago(FINISHED_WINDOW_MS - 1_000) });
    expect(pickFocus([older], done, now)).toBe(done);
    const stale = request({ status: "completed", finishedAt: ago(FINISHED_WINDOW_MS + 1_000) });
    expect(pickFocus([older], stale, now)).toBe(older);
  });

  it("is null when nothing runs", () => {
    expect(pickFocus([], null, now)).toBeNull();
  });
});

describe("toLiveRequest", () => {
  it("reports exact chunk progress and flags a stale heartbeat", () => {
    const doc = request({
      startedAt: ago(60_000),
      heartbeatAt: ago(120_000),
      progress: {
        stage: "reviewing",
        path: "full",
        stageStartedAt: ago(30_000),
        updatedAt: ago(5_000),
        chunks: {
          total: 5,
          done: 2,
          failed: 0,
          running: 3,
          repairs: 1,
          unreviewedFiles: 0,
          startedAt: { "2": ago(300_000), "3": ago(20_000) },
        },
      },
    });
    const live = toLiveRequest(doc, "o/r", null, now);
    expect(live).toMatchObject({
      repoFullName: "o/r",
      label: "Reviewing chunks",
      percent: 40,
      chunks: { done: 2, running: 3, waiting: 0, repairs: 1 },
      oldestChunk: { number: 3, startedAt: ago(300_000).toISOString() },
      slowChunk: true,
      stalled: true,
    });
  });

  it("joins the result and shows no bar for a run without chunks", () => {
    const doc = request({
      status: "completed",
      finishedAt: ago(1_000),
      progress: { stage: "saving", path: "empty", stageStartedAt: ago(2_000), updatedAt: ago(2_000) },
    });
    const live = toLiveRequest(doc, "o/r", { verdict: "COMMENT", findings: 0 }, now);
    expect(live.percent).toBeNull();
    expect(live.slowChunk).toBe(false);
    expect(live.result).toEqual({ verdict: "COMMENT", findings: 0 });
    expect(live.stalled).toBe(false);
  });

  it("labels a queued request and has no bar until the path is known", () => {
    const live = toLiveRequest(request({ status: "queued" }), "o/r", null, now);
    expect(live.label).toBe("Waiting to start");
    expect(live.percent).toBeNull();
  });
});
