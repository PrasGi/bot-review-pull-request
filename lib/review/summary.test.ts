import { describe, it, expect } from "vitest";
import { composeSummary, buildReviewBody } from "@/lib/review/summary";

describe("composeSummary — an APPROVE must say why", () => {
  it("uses the model's own summary when the review ran as a single chunk", () => {
    const result = composeSummary({
      verdict: "APPROVE",
      summary: "Adds cursor pagination to the projects list.",
      chunkSummaries: [],
    });
    expect(result).toBe("Adds cursor pagination to the projects list.");
  });

  it("appends the verdict reason as its own paragraph", () => {
    const result = composeSummary({
      verdict: "APPROVE",
      summary: "Adds cursor pagination to the projects list.",
      verdictReason:
        "The query is parameterised and the new branch is covered by tests, so nothing blocks merge.",
    });
    expect(result).toBe(
      [
        "Adds cursor pagination to the projects list.",
        "",
        "The query is parameterised and the new branch is covered by tests, so nothing blocks merge.",
      ].join("\n"),
    );
  });

  it("does not repeat the verdict reason when it merely restates the summary", () => {
    const result = composeSummary({
      verdict: "APPROVE",
      summary: "No blocking issues found.",
      verdictReason: "no blocking issues found",
    });
    expect(result).toBe("No blocking issues found.");
  });

  it("builds the summary from per-chunk summaries when the model gave no overall one", () => {
    const result = composeSummary({
      verdict: "APPROVE",
      chunkSummaries: [
        "Adds the pagination helper and its unit tests.",
        "Wires page/limit through the projects API route.",
      ],
    });
    expect(result).toBe(
      [
        "- Adds the pagination helper and its unit tests.",
        "- Wires page/limit through the projects API route.",
      ].join("\n"),
    );
  });

  it("renders a lone chunk summary as prose rather than a one-item list", () => {
    const result = composeSummary({
      verdict: "APPROVE",
      chunkSummaries: ["Adds the pagination helper and its unit tests."],
    });
    expect(result).toBe("Adds the pagination helper and its unit tests.");
  });

  it("ignores blank chunk summaries", () => {
    const result = composeSummary({
      verdict: "APPROVE",
      chunkSummaries: ["   ", "Wires page/limit through the API route.", ""],
    });
    expect(result).toBe("Wires page/limit through the API route.");
  });

  it("falls back to generic text only when the model returned nothing usable", () => {
    expect(
      composeSummary({ verdict: "APPROVE", chunkSummaries: ["  "] }),
    ).toBe("All good — no blocking issues found.");
    expect(composeSummary({ verdict: "REQUEST_CHANGES" })).toBe("See comments.");
  });

  it("keeps the verdict reason even when only chunk summaries are available", () => {
    const result = composeSummary({
      verdict: "REQUEST_CHANGES",
      chunkSummaries: ["Rewrites the token refresh flow."],
      verdictReason: "The refresh token is logged in plaintext on line 42.",
    });
    expect(result).toContain("Rewrites the token refresh flow.");
    expect(result).toContain("The refresh token is logged in plaintext on line 42.");
  });
});

describe("buildReviewBody", () => {
  it("surfaces the composed reason under the approval banner", () => {
    const body = buildReviewBody({
      verdict: "APPROVE",
      summary: composeSummary({
        verdict: "APPROVE",
        chunkSummaries: ["Adds retry handling to the webhook dispatcher."],
        verdictReason: "Retries are bounded and the backoff is deterministic.",
      }),
      newerCommits: false,
      shortSha: "abc1234",
    });
    expect(body).toContain("**Approved ✅**");
    expect(body).toContain("Adds retry handling to the webhook dispatcher.");
    expect(body).toContain("Retries are bounded and the backoff is deterministic.");
  });
});
