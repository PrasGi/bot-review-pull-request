import { describe, it, expect } from "vitest";
import {
  resolveVerdict,
  enforceKnobs,
  filterFindingsToValidLines,
} from "@/lib/review/verdict";
import type { RepoConfig } from "@/lib/db/types";
import type { FindingOutput } from "@/lib/review/schemas";

function config(overrides: Partial<RepoConfig> = {}): RepoConfig {
  return {
    provider: null,
    model: null,
    reviewProfile: "normal",
    autoVerdict: true,
    confidenceThreshold: 0.6,
    customGuidelines: "",
    ignorePatterns: [],
    contextFiles: [],
    maxChunks: 3,
    ...overrides,
  };
}

function finding(overrides: Partial<FindingOutput> = {}): FindingOutput {
  return {
    path: "src/a.ts",
    line: 10,
    severity: "minor",
    category: "bug",
    comment: "something is off here in this line",
    ...overrides,
  };
}

describe("resolveVerdict", () => {
  it("forces REQUEST_CHANGES when a critical finding exists", () => {
    const r = resolveVerdict({
      proposed: "APPROVE",
      confidence: 0.9,
      intentMatch: { status: "match", explanation: "" },
      findings: [finding({ severity: "critical" })],
      config: config(),
    });
    expect(r.verdict).toBe("REQUEST_CHANGES");
    expect(r.forced).toBe("critical_findings");
  });

  it("caps to COMMENT when confidence is below threshold", () => {
    const r = resolveVerdict({
      proposed: "APPROVE",
      confidence: 0.3,
      intentMatch: { status: "match", explanation: "" },
      findings: [],
      config: config(),
    });
    expect(r.verdict).toBe("COMMENT");
    expect(r.forced).toBe("low_confidence");
  });

  it("forces COMMENT when autoVerdict is disabled", () => {
    const r = resolveVerdict({
      proposed: "REQUEST_CHANGES",
      confidence: 0.9,
      intentMatch: { status: "match", explanation: "" },
      findings: [],
      config: config({ autoVerdict: false }),
    });
    expect(r.verdict).toBe("COMMENT");
    expect(r.forced).toBe("auto_verdict_off");
  });

  it("forbids APPROVE on intent mismatch", () => {
    const r = resolveVerdict({
      proposed: "APPROVE",
      confidence: 0.9,
      intentMatch: { status: "mismatch", explanation: "hidden changes" },
      findings: [],
      config: config(),
    });
    expect(r.verdict).toBe("COMMENT");
    expect(r.forced).toBe("intent_mismatch");
  });

  it("passes a clean APPROVE through untouched", () => {
    const r = resolveVerdict({
      proposed: "APPROVE",
      confidence: 0.9,
      intentMatch: { status: "match", explanation: "" },
      findings: [finding({ severity: "nit" })],
      config: config(),
    });
    expect(r.verdict).toBe("APPROVE");
    expect(r.forced).toBeUndefined();
  });
});

describe("enforceKnobs", () => {
  it("drops findings below the profile severity floor (chill = major)", () => {
    const { kept } = enforceKnobs(
      [finding({ severity: "nit" }), finding({ severity: "critical" })],
      "chill",
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.severity).toBe("critical");
  });

  it("caps findings to the profile maximum and sorts by severity", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      finding({ severity: i === 0 ? "critical" : "minor", line: i + 1 }),
    );
    const { kept } = enforceKnobs(many, "chill");
    expect(kept.length).toBeLessThanOrEqual(5);
    expect(kept[0]?.severity).toBe("critical");
  });
});

describe("filterFindingsToValidLines", () => {
  it("drops findings whose line is not in a new hunk", () => {
    const lines = new Map([["src/a.ts", new Set([10, 11])]]);
    const { kept, droppedCount } = filterFindingsToValidLines(
      [finding({ line: 10 }), finding({ line: 99 })],
      lines,
    );
    expect(kept).toHaveLength(1);
    expect(droppedCount).toBe(1);
  });
});
