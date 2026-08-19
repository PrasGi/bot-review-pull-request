import { describe, it, expect } from "vitest";
import {
  chunkReviewSchema,
  describeChunkSalvage,
} from "@/lib/review/schemas";

function response(overrides: Record<string, unknown> = {}): unknown {
  return {
    findings: [],
    chunkSummary: "looks fine",
    ...overrides,
  };
}

describe("chunkReviewSchema", () => {
  it("accepts an intentMatch that omits explanation", () => {
    const parsed = chunkReviewSchema.parse(
      response({ intentMatch: { status: "match" } }),
    );

    expect(parsed.intentMatch).toEqual({ status: "match", explanation: "" });
  });

  it("accepts a response that omits chunkSummary", () => {
    const parsed = chunkReviewSchema.parse({ findings: [] });

    expect(parsed.chunkSummary).toBe("");
  });

  it("drops an intentMatch with an unknown status instead of rejecting", () => {
    const parsed = chunkReviewSchema.parse(
      response({ intentMatch: { status: "unsure", explanation: "hm" } }),
    );

    expect(parsed.intentMatch).toBeUndefined();
    expect(parsed.chunkSummary).toBe("looks fine");
  });

  it("drops a non-numeric confidence instead of rejecting", () => {
    const parsed = chunkReviewSchema.parse(response({ confidence: "high" }));

    expect(parsed.confidence).toBeUndefined();
  });

  it("drops an unknown verdict instead of rejecting", () => {
    const parsed = chunkReviewSchema.parse(response({ verdict: "LGTM" }));

    expect(parsed.verdict).toBeUndefined();
  });

  it("rescales a 0-100 confidence to 0-1", () => {
    const parsed = chunkReviewSchema.parse(response({ confidence: 85 }));

    expect(parsed.confidence).toBeCloseTo(0.85);
  });

  it("truncates an overlong chunkSummary rather than rejecting it", () => {
    const parsed = chunkReviewSchema.parse(
      response({ chunkSummary: "x".repeat(900) }),
    );

    expect(parsed.chunkSummary).toHaveLength(600);
  });

  it("falls back to an empty chunkSummary when the model sends a non-string", () => {
    const parsed = chunkReviewSchema.parse(response({ chunkSummary: 123 }));

    expect(parsed.chunkSummary).toBe("");
  });

  it("keeps valid findings and drops malformed ones", () => {
    const parsed = chunkReviewSchema.parse(
      response({
        findings: [
          {
            path: "src/a.ts",
            line: 10,
            severity: "major",
            category: "bug",
            comment: "off by one",
            blocking: true,
          },
          { path: "", line: 0, severity: "nope" },
        ],
      }),
    );

    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0]?.path).toBe("src/a.ts");
  });

  it("recovers a finding whose comment was sent as \"breakdown\"", () => {
    const parsed = chunkReviewSchema.parse(
      response({
        findings: [
          {
            path: "src/a.ts",
            line: 10,
            severity: "major",
            category: "bug",
            breakdown: "off by one",
            blocking: true,
          },
        ],
      }),
    );

    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0]?.comment).toBe("off by one");
  });

  // A response with no findings array is not a review the model actually
  // produced. Defaulting it to [] would read as "nothing wrong" and let the
  // verdict step post a false APPROVE, so it must stay fatal.
  it("rejects a response with no findings array", () => {
    expect(() => chunkReviewSchema.parse({ chunkSummary: "done" })).toThrow();
  });

  it("rejects a findings value that is not an array", () => {
    expect(() =>
      chunkReviewSchema.parse(response({ findings: "none" })),
    ).toThrow();
  });

  // The model reported problems; if every one is unreadable we must not hand
  // the verdict step an empty list, which it would read as a clean PR.
  it("rejects a findings array where every entry is malformed", () => {
    expect(() =>
      chunkReviewSchema.parse(
        response({
          findings: [
            { path: "src/a.ts", line: 3, severity: "high", category: "bug" },
            { path: "", line: 0 },
          ],
        }),
      ),
    ).toThrow();
  });

  it("still accepts an originally empty findings array as a clean review", () => {
    const parsed = chunkReviewSchema.parse(response({ findings: [] }));

    expect(parsed.findings).toEqual([]);
  });
});

describe("describeChunkSalvage", () => {
  it("reports nothing when the response parsed cleanly", () => {
    const raw = response({ confidence: 0.8 });

    expect(describeChunkSalvage(raw, chunkReviewSchema.parse(raw))).toEqual([]);
  });

  it("names each field that was present but dropped", () => {
    const raw = response({ confidence: "high", verdict: "LGTM" });

    expect(describeChunkSalvage(raw, chunkReviewSchema.parse(raw))).toEqual([
      'dropped malformed "verdict"',
      'dropped malformed "confidence"',
    ]);
  });

  it("counts findings that were dropped", () => {
    const raw = response({
      findings: [
        {
          path: "src/a.ts",
          line: 10,
          severity: "major",
          category: "bug",
          comment: "off by one",
          blocking: false,
        },
        { path: "", line: 0 },
      ],
    });

    expect(describeChunkSalvage(raw, chunkReviewSchema.parse(raw))).toEqual([
      "dropped 1 of 2 findings",
    ]);
  });

  it("ignores a non-object response", () => {
    expect(describeChunkSalvage(null, chunkReviewSchema.parse(response()))).toEqual(
      [],
    );
  });
});
