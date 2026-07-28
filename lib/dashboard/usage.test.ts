import { describe, it, expect } from "vitest";
import { usageToCsv, type UsageSummary } from "@/lib/dashboard/usage";

const summary: UsageSummary = {
  totalCost: 0.5,
  totalPromptTokens: 1000,
  totalCompletionTokens: 500,
  totalCalls: 3,
  rows: [
    {
      group: "glm-4.6",
      calls: 2,
      promptTokens: 800,
      completionTokens: 400,
      costUsd: 0.4,
      avgLatencyMs: 15000,
      errorRate: 0,
    },
    {
      group: 'repo "quoted"',
      calls: 1,
      promptTokens: 200,
      completionTokens: 100,
      costUsd: 0.1,
      avgLatencyMs: 20000,
      errorRate: 0.5,
    },
  ],
};

describe("usageToCsv", () => {
  it("emits a header and one line per row", () => {
    const csv = usageToCsv(summary);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("group,calls");
    expect(lines).toHaveLength(3);
  });

  it("escapes double quotes in group names", () => {
    const csv = usageToCsv(summary);
    expect(csv).toContain('"repo ""quoted"""');
  });

  it("formats cost and error rate with fixed precision", () => {
    const csv = usageToCsv(summary);
    expect(csv).toContain("0.400000");
    expect(csv).toContain("0.5000");
  });
});
