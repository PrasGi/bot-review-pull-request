import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const updateOne = vi.fn();
vi.mock("@/lib/db/collections", () => ({
  reviewRequestsCollection: async () => ({ updateOne }),
}));
vi.mock("@/lib/logger", () => ({ log: { warn: vi.fn() }, errorFields: () => ({}) }));

const { createProgressReporter } = await import("@/lib/review/progress-store");

const id = new ObjectId();

describe("createProgressReporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("sets the stage and extra fields only while processing", async () => {
    await createProgressReporter(id).stage("filtering", { files: { changed: 3, kept: 2, skipped: 1 } });
    const [filter, update] = updateOne.mock.calls[0] as [Record<string, unknown>, { $set: Record<string, unknown> }];
    expect(filter).toEqual({ _id: id, status: "processing" });
    expect(update.$set).toMatchObject({
      "progress.stage": "filtering",
      "progress.files": { changed: 3, kept: 2, skipped: 1 },
    });
    expect(update.$set["progress.stageStartedAt"]).toBeInstanceOf(Date);
  });

  it("counts chunks with $inc so parallel chunks never race", async () => {
    const reporter = createProgressReporter(id);
    await reporter.chunkStarted();
    await reporter.chunkFinished(true);
    await reporter.chunkFinished(false);
    await reporter.chunkRepaired();
    const incs = updateOne.mock.calls.map((call) => (call[1] as { $inc: unknown }).$inc);
    expect(incs).toEqual([
      { "progress.chunks.running": 1 },
      { "progress.chunks.running": -1, "progress.chunks.done": 1 },
      { "progress.chunks.running": -1, "progress.chunks.failed": 1 },
      { "progress.chunks.repairs": 1 },
    ]);
  });

  it("never throws when a write fails", async () => {
    updateOne.mockRejectedValue(new Error("db down"));
    await expect(createProgressReporter(id).stage("posting")).resolves.toBeUndefined();
  });
});
