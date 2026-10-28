import { describe, expect, it } from "vitest";
import { computeReadCoverage } from "@/lib/review/coverage";

const ok = (value: unknown): PromiseSettledResult<unknown> => ({ status: "fulfilled", value });
const failed: PromiseSettledResult<unknown> = { status: "rejected", reason: new Error("Request timed out.") };

describe("computeReadCoverage", () => {
  it("counts every file as read when every chunk came back", () => {
    expect(
      computeReadCoverage({
        totalFiles: 3,
        overBudget: [],
        chunkFiles: [["a.ts", "b.ts"], ["c.ts"]],
        settled: [ok({}), ok({})],
      }),
    ).toEqual({ reviewedCount: 3, unreadFiles: [] });
  });

  it("names the files of a chunk that timed out instead of claiming them as read", () => {
    expect(
      computeReadCoverage({
        totalFiles: 9,
        overBudget: [],
        chunkFiles: [["src/service.ts", "src/tools.ts"], ["AGENTS.md"]],
        settled: [failed, ok({})],
      }),
    ).toEqual({ reviewedCount: 7, unreadFiles: ["src/service.ts", "src/tools.ts"] });
  });

  it("treats a chunk that returned nothing as unread", () => {
    expect(
      computeReadCoverage({
        totalFiles: 2,
        overBudget: [],
        chunkFiles: [["a.ts"], ["b.ts"]],
        settled: [ok(null), ok({})],
      }),
    ).toEqual({ reviewedCount: 1, unreadFiles: ["a.ts"] });
  });

  it("combines files over the token budget with files from failed chunks", () => {
    expect(
      computeReadCoverage({
        totalFiles: 4,
        overBudget: ["huge.ts"],
        chunkFiles: [["a.ts"], ["b.ts", "c.ts"]],
        settled: [ok({}), failed],
      }),
    ).toEqual({ reviewedCount: 1, unreadFiles: ["huge.ts", "b.ts", "c.ts"] });
  });
});
