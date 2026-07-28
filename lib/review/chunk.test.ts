import { describe, it, expect } from "vitest";
import { chunkFiles, prioritizeFiles } from "@/lib/review/chunk";
import type { PrFile } from "@/lib/review/diff-format";

function file(name: string, patchLen: number): PrFile {
  return {
    filename: name,
    status: "modified",
    additions: 1,
    deletions: 0,
    patch: "x".repeat(patchLen),
  };
}

const BUDGET = { chunkTokens: 6000, totalInputBudget: 30000, maxChunks: 3 };

describe("chunkFiles", () => {
  it("packs small files into a single chunk", () => {
    const { chunks, unreviewed } = chunkFiles(
      [file("a.ts", 300), file("b.ts", 300)],
      BUDGET,
    );
    expect(chunks).toHaveLength(1);
    expect(unreviewed).toHaveLength(0);
  });

  it("never exceeds maxChunks and skips the overflow", () => {
    // Each file ~6000 tokens (18000 chars / 3). 5 files, max 3 chunks.
    const files = Array.from({ length: 5 }, (_, i) => file(`f${i}.ts`, 18000));
    const { chunks, unreviewed } = chunkFiles(files, BUDGET);
    expect(chunks.length).toBeLessThanOrEqual(3);
    expect(unreviewed.length).toBeGreaterThan(0);
  });

  it("stops packing once the total input budget is hit", () => {
    // 10 files of ~6000 tokens each = 60000 > 30000 budget.
    const files = Array.from({ length: 10 }, (_, i) => file(`f${i}.ts`, 18000));
    const { chunks, unreviewed } = chunkFiles(files, BUDGET);
    const packedTokens = chunks.reduce((s, c) => s + c.tokenEstimate, 0);
    expect(packedTokens).toBeLessThanOrEqual(30000);
    expect(unreviewed.length).toBeGreaterThan(0);
  });

  it("truncates an oversized single file so the chunk stays within budget", () => {
    // One 60k-char file (~20k tokens) must be truncated to fit a 6k-token chunk.
    const { chunks } = chunkFiles([file("huge.ts", 60000)], BUDGET);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.tokenEstimate).toBeLessThanOrEqual(6000);
    expect(chunks[0]?.files[0]?.patch).toContain("[diff truncated for size]");
  });

  it("prioritizes source code over docs", () => {
    const ordered = prioritizeFiles([
      file("README.md", 100),
      file("src/app.ts", 100),
    ]);
    expect(ordered[0]?.filename).toBe("src/app.ts");
  });
});
