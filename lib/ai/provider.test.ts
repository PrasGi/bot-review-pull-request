import { describe, it, expect } from "vitest";
import { stripJsonFences, computeCostUsd } from "@/lib/ai/provider";
import type { ModelPricing } from "@/lib/db/types";

describe("stripJsonFences", () => {
  it("removes ```json fences", () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("removes bare ``` fences", () => {
    expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("leaves unfenced JSON untouched", () => {
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe("computeCostUsd", () => {
  const pricing: ModelPricing = {
    provider: "glm",
    model: "glm-4.7",
    inputPerM: 0.6,
    outputPerM: 2.2,
    updatedAt: new Date(),
  };

  it("computes cost from token usage and pricing", () => {
    const cost = computeCostUsd(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      pricing,
    );
    expect(cost).toBeCloseTo(2.8, 5);
  });

  it("returns 0 when pricing is unknown", () => {
    expect(
      computeCostUsd({ promptTokens: 100, completionTokens: 100 }, undefined),
    ).toBe(0);
  });
});
