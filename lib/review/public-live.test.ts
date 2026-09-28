import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import type { ReviewRequestDoc } from "@/lib/db/types";
import { PUBLIC_LIVE_COPY } from "@/lib/review/progress-copy";
import { chunkRows, isLiveLinkExpired, LIVE_LINK_TTL_MS, toPublicLive } from "@/lib/review/public-live";

const now = new Date("2026-09-28T12:00:00Z");
const ago = (ms: number): Date => new Date(now.getTime() - ms);

function request(overrides: Partial<ReviewRequestDoc> = {}): ReviewRequestDoc {
  return {
    _id: new ObjectId(),
    deliveryId: "d",
    userConnectionId: new ObjectId(),
    installationId: 1,
    repoId: new ObjectId(),
    prNumber: 3,
    prTitle: "Add ops modules",
    prAuthor: "a",
    prUrl: "https://github.com/o/r/pull/3",
    headSha: "abc",
    baseSha: "def",
    kind: "initial",
    trigger: "review_requested",
    status: "processing",
    createdAt: ago(60_000),
    startedAt: ago(50_000),
    liveTokenHash: "secret-hash",
    statusComment: { id: 42, postedAt: ago(49_000) },
    progress: {
      stage: "reviewing",
      path: "full",
      stageStartedAt: ago(30_000),
      updatedAt: ago(1_000),
      model: { provider: "glm", model: "glm-5.2" },
      profile: "professional",
      chunkFiles: [["src/a.ts"], ["src/b.ts", "src/c.ts"], ["src/d.ts"]],
      chunks: {
        total: 3,
        done: 1,
        failed: 0,
        running: 1,
        repairs: 0,
        unreviewedFiles: 0,
        startedAt: { "1": ago(20_000) },
        finished: { "0": "done" },
      },
    },
    ...overrides,
  };
}

describe("chunkRows", () => {
  it("gives each chunk its files and exact state", () => {
    expect(chunkRows(request())).toEqual([
      { number: 1, files: ["src/a.ts"], state: "done", startedAt: null },
      { number: 2, files: ["src/b.ts", "src/c.ts"], state: "running", startedAt: ago(20_000).toISOString() },
      { number: 3, files: ["src/d.ts"], state: "waiting", startedAt: null },
    ]);
  });
});

describe("toPublicLive", () => {
  it("shows model, character and progress", () => {
    const live = toPublicLive(request(), "o/r", null, now);
    expect(live.model).toEqual({ providerLabel: "GLM", model: "glm-5.2" });
    expect(live.character?.label).toBe("Professional");
    expect(live.percent).toBe(33);
    expect(live.chunkRows).toHaveLength(3);
  });

  it("never exposes ids, token hashes or raw error text", () => {
    const failed = request({
      status: "failed",
      finishedAt: ago(1_000),
      error: { stage: "pipeline", message: "chunk 1: provider said sk-secret" },
    });
    const live = toPublicLive(failed, "o/r", null, now);
    const json = JSON.stringify(live);
    expect(live).not.toHaveProperty("id");
    expect(live.error).toBe(PUBLIC_LIVE_COPY.failed);
    expect(json).not.toContain("sk-secret");
    expect(json).not.toContain("secret-hash");
    expect(json).not.toContain(failed._id.toHexString());
    expect(json).not.toContain(failed.repoId.toHexString());
  });
});

describe("isLiveLinkExpired", () => {
  it("keeps the link for 24 hours after the run finishes", () => {
    expect(isLiveLinkExpired({ finishedAt: undefined }, now)).toBe(false);
    expect(isLiveLinkExpired({ finishedAt: ago(LIVE_LINK_TTL_MS - 1_000) }, now)).toBe(false);
    expect(isLiveLinkExpired({ finishedAt: ago(LIVE_LINK_TTL_MS + 1_000) }, now)).toBe(true);
  });
});
