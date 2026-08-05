import { describe, it, expect } from "vitest";
import { applyScopeGuard, collectRemovedLines } from "@/lib/review/scope-guard";
import type { FindingOutput } from "@/lib/review/schemas";

function finding(overrides: Partial<FindingOutput> = {}): FindingOutput {
  return {
    path: "src/config.controller.ts",
    line: 48,
    severity: "major",
    category: "security",
    comment: "generic issue",
    blocking: true,
    ...overrides,
  };
}

const BASE = { profile: "chill" as const, removedDiffText: "", customGuidelines: "" };

describe("applyScopeGuard — the AuthGuard incident", () => {
  const authFinding = finding({
    comment:
      "The PUT /config/whatsapp-community endpoint is missing an authentication or authorization guard (e.g., @UseGuards(AdminAuthGuard)).",
  });

  it("drops a missing-guard finding on chill when the diff removed nothing", () => {
    const result = applyScopeGuard([authFinding], BASE);
    expect(result.kept).toHaveLength(0);
    expect(result.droppedCount).toBe(1);
  });

  it("downgrades to non-blocking on professional instead of dropping", () => {
    const result = applyScopeGuard([authFinding], {
      ...BASE,
      profile: "professional",
    });
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.blocking).toBe(false);
    expect(result.kept[0]?.comment).toMatch(/^Please double-check/);
  });

  it("KEEPS the finding when the diff itself removed a guard (regression)", () => {
    const result = applyScopeGuard([authFinding], {
      ...BASE,
      removedDiffText: "-  @UseGuards(AdminAuthGuard)",
    });
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.blocking).toBe(true);
  });

  it("KEEPS the finding when custom guidelines demand per-route guards", () => {
    const result = applyScopeGuard([authFinding], {
      ...BASE,
      customGuidelines: "Every route must declare @UseGuards explicitly.",
    });
    expect(result.kept).toHaveLength(1);
  });
});

describe("applyScopeGuard — other out-of-context rules", () => {
  it("drops consistency-with-codebase findings", () => {
    const result = applyScopeGuard(
      [finding({ comment: "Other routes return { data } — this is inconsistent with the rest of the codebase." })],
      BASE,
    );
    expect(result.kept).toHaveLength(0);
  });

  it("drops undefined-symbol speculation", () => {
    const result = applyScopeGuard(
      [finding({ comment: "WHATSAPP_CONFIG_KEY is not defined anywhere in this file." })],
      BASE,
    );
    expect(result.kept).toHaveLength(0);
  });

  it("drops missing-validation findings on chill", () => {
    const result = applyScopeGuard(
      [finding({ comment: "The groupLink body field is used without validation." })],
      BASE,
    );
    expect(result.kept).toHaveLength(0);
  });

  it("downgrades blocking speculation to non-blocking", () => {
    const result = applyScopeGuard(
      [finding({ comment: "This could be a race condition depending on another file." })],
      BASE,
    );
    expect(result.kept[0]?.blocking).toBe(false);
  });

  it("downgrades blocking N+1 claims", () => {
    const result = applyScopeGuard(
      [finding({ comment: "This loop causes an N+1 query problem." })],
      BASE,
    );
    expect(result.kept[0]?.blocking).toBe(false);
  });

  it("drops test-coverage nags on chill but keeps non-blocking elsewhere", () => {
    const nag = finding({ comment: "There are no tests for this new service." });
    expect(applyScopeGuard([nag], BASE).kept).toHaveLength(0);
    const pro = applyScopeGuard([nag], { ...BASE, profile: "professional" });
    expect(pro.kept).toHaveLength(1);
    expect(pro.kept[0]?.blocking).toBe(false);
  });

  it("keeps genuine diff-verifiable findings untouched", () => {
    const secret = finding({
      comment: "A hardcoded API key is committed in this diff.",
      category: "security",
    });
    const result = applyScopeGuard([secret], BASE);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.blocking).toBe(true);
  });
});

describe("applyScopeGuard — named vulnerabilities survive the heuristics", () => {
  it("keeps an open-redirect finding that the missing-validation rule would drop on chill", () => {
    const result = applyScopeGuard(
      [
        finding({
          comment:
            "The redirect target is taken from the query string without validation — this is an open redirect.",
        }),
      ],
      BASE,
    );
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.blocking).toBe(true);
    expect(result.droppedCount).toBe(0);
  });

  it("keeps a path-traversal finding that mentions other routes", () => {
    const result = applyScopeGuard(
      [
        finding({
          comment:
            "Other routes sanitize this, but here the filename reaches fs.readFile allowing path traversal.",
        }),
      ],
      BASE,
    );
    expect(result.kept).toHaveLength(1);
  });

  it("keeps an unverified-JWT-signature finding without hedging it", () => {
    const result = applyScopeGuard(
      [finding({ comment: "This decodes the JWT but never performs signature verification." })],
      BASE,
    );
    expect(result.kept[0]?.comment).not.toMatch(/^Please double-check/);
    expect(result.kept[0]?.blocking).toBe(true);
  });

  it("reports how many findings bypassed the guard on security grounds", () => {
    const result = applyScopeGuard(
      [
        finding({ comment: "User input is concatenated into a SQL injection sink." }),
        finding({ comment: "There are no tests for this new service." }),
      ],
      BASE,
    );
    expect(result.securityKeptCount).toBe(1);
    expect(result.droppedCount).toBe(1);
  });

  it("does not treat an ordinary missing-guard finding as a named vulnerability", () => {
    const result = applyScopeGuard(
      [finding({ comment: "This endpoint is missing an authorization guard." })],
      BASE,
    );
    expect(result.securityKeptCount).toBe(0);
    expect(result.kept).toHaveLength(0);
  });
});

describe("collectRemovedLines", () => {
  it("collects only removed lines, ignoring file headers", () => {
    const patch = [
      "--- a/x.ts",
      "+++ b/x.ts",
      "-  @UseGuards(AdminAuthGuard)",
      "+  // moved",
      " context line",
    ].join("\n");
    const removed = collectRemovedLines([patch, undefined]);
    expect(removed).toContain("@UseGuards");
    expect(removed).not.toContain("+++");
  });
});
