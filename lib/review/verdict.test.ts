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
    blocking: false,
    ...overrides,
  };
}

describe("resolveVerdict", () => {
  it("requests changes only for a blocking finding", () => {
    const r = resolveVerdict({
      intentMatch: { status: "match", explanation: "" },
      findings: [finding({ severity: "critical", blocking: true })],
      config: config(),
    });
    expect(r.verdict).toBe("REQUEST_CHANGES");
  });

  it("approves with a caveat when an uncertain (non-blocking) issue exists", () => {
    const r = resolveVerdict({
      intentMatch: { status: "match", explanation: "" },
      findings: [finding({ severity: "major", blocking: false })],
      config: config(),
    });
    expect(r.verdict).toBe("APPROVE");
    expect(r.caveat).toBeTruthy();
  });

  it("does NOT block on a critical finding the model is unsure about", () => {
    const r = resolveVerdict({
      intentMatch: { status: "match", explanation: "" },
      findings: [finding({ severity: "critical", blocking: false })],
      config: config(),
    });
    expect(r.verdict).toBe("APPROVE");
  });

  it("forces COMMENT when autoVerdict is disabled", () => {
    const r = resolveVerdict({
      intentMatch: { status: "match", explanation: "" },
      findings: [],
      config: config({ autoVerdict: false }),
    });
    expect(r.verdict).toBe("COMMENT");
    expect(r.forced).toBe("auto_verdict_off");
  });

  it("approves with a caveat on intent mismatch (does not block)", () => {
    const r = resolveVerdict({
      intentMatch: { status: "mismatch", explanation: "hidden changes" },
      findings: [],
      config: config(),
    });
    expect(r.verdict).toBe("APPROVE");
    expect(r.forced).toBe("intent_mismatch");
    expect(r.caveat).toBeTruthy();
  });

  it("approves cleanly with only nits", () => {
    const r = resolveVerdict({
      intentMatch: { status: "match", explanation: "" },
      findings: [finding({ severity: "nit", blocking: false })],
      config: config(),
    });
    expect(r.verdict).toBe("APPROVE");
    expect(r.caveat).toBeUndefined();
  });

  it("a blocker overrides intent mismatch", () => {
    const r = resolveVerdict({
      intentMatch: { status: "mismatch", explanation: "x" },
      findings: [finding({ blocking: true })],
      config: config(),
    });
    expect(r.verdict).toBe("REQUEST_CHANGES");
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
