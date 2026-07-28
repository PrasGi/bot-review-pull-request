import { describe, it, expect } from "vitest";
import {
  buildUserPrompt,
  type UserPromptInput,
  type PreviousFindingLine,
} from "@/lib/review/prompt";

function baseInput(overrides: Partial<UserPromptInput> = {}): UserPromptInput {
  return {
    prTitle: "add feature",
    prBody: "does a thing",
    headBranch: "feat",
    baseBranch: "main",
    prAuthor: "someone",
    commitMessages: ["add feature"],
    chunkIndex: 1,
    chunkTotal: 1,
    filesInChunk: 1,
    filesTotal: 1,
    formattedDiff: "## File: 'a.ts'",
    ...overrides,
  };
}

describe("buildUserPrompt", () => {
  it("omits the previous-findings block on an initial review", () => {
    const out = buildUserPrompt(baseInput());
    expect(out).not.toContain("YOUR PREVIOUS FINDINGS");
  });

  it("includes previous findings and delta instruction on re-review", () => {
    const prev: PreviousFindingLine[] = [
      {
        path: "src/a.ts",
        line: 10,
        severity: "major",
        blocking: true,
        comment: "missing null check",
      },
    ];
    const out = buildUserPrompt(baseInput({ previousFindings: prev }));
    expect(out).toContain("YOUR PREVIOUS FINDINGS");
    expect(out).toContain("src/a.ts:10 [major/blocking] missing null check");
    expect(out).toContain("ONLY the code that changed since your last review");
  });

  it("caps and truncates a noisy previous-findings list", () => {
    const many: PreviousFindingLine[] = Array.from({ length: 30 }, (_, i) => ({
      path: `f${i}.ts`,
      line: i + 1,
      severity: "minor",
      blocking: false,
      comment: "x".repeat(500),
    }));
    const out = buildUserPrompt(baseInput({ previousFindings: many }));
    expect(out).toContain("f0.ts");
    expect(out).not.toContain("f25.ts");
    expect(out).not.toContain("x".repeat(200));
  });

  it("wraps untrusted PR body and diff in data delimiters", () => {
    const out = buildUserPrompt(baseInput());
    expect(out).toContain("<pr_data>");
    expect(out).toContain("</pr_data>");
  });
});
