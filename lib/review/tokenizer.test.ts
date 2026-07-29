import { describe, it, expect } from "vitest";
import {
  countTokens,
  effectiveBudget,
  truncateToTokens,
  PROVIDER_BUDGET_MULTIPLIER,
} from "@/lib/review/tokenizer";

describe("countTokens", () => {
  it("returns 0 for empty text", () => {
    expect(countTokens("")).toBe(0);
  });

  it("uses the char heuristic for short text", () => {
    expect(countTokens("x".repeat(300))).toBe(100);
  });

  it("uses the char heuristic (not real BPE) for pathologically long text", () => {
    const start = Date.now();
    const tokens = countTokens("x".repeat(60_000));
    expect(Date.now() - start).toBeLessThan(1000);
    expect(tokens).toBe(20_000);
  });
});

describe("effectiveBudget", () => {
  it("does not shrink the budget for openai (multiplier 1.0)", () => {
    expect(effectiveBudget(24_000, "openai")).toBe(24_000);
  });

  it("shrinks the budget most for anthropic (multiplier 1.25)", () => {
    expect(effectiveBudget(24_000, "anthropic")).toBe(19_200);
  });

  it("applies glm and kimi safety margins", () => {
    expect(effectiveBudget(24_000, "glm")).toBe(
      Math.floor(24_000 / PROVIDER_BUDGET_MULTIPLIER.glm),
    );
    expect(effectiveBudget(24_000, "kimi")).toBe(
      Math.floor(24_000 / PROVIDER_BUDGET_MULTIPLIER.kimi),
    );
  });
});

describe("truncateToTokens", () => {
  it("returns text unchanged when already within budget", () => {
    const text = "short and sweet";
    expect(truncateToTokens(text, 1000)).toBe(text);
  });

  it("truncates oversized text to fit within the token budget", () => {
    const text = "const value = 42;\n".repeat(500);
    const truncated = truncateToTokens(text, 100);
    expect(countTokens(truncated)).toBeLessThanOrEqual(100);
    expect(truncated).toContain("truncated");
  });

  it("preserves head and tail context around the truncation marker", () => {
    const text = `HEAD_MARKER\n${"middle line\n".repeat(400)}TAIL_MARKER`;
    const truncated = truncateToTokens(text, 120);
    expect(truncated.startsWith("HEAD_MARKER")).toBe(true);
    expect(truncated.endsWith("TAIL_MARKER")).toBe(true);
  });
});
