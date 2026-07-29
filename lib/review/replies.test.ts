import { describe, it, expect } from "vitest";
import {
  mapFindingsToReplies,
  evaluateReplies,
  computeReplyVerdict,
} from "@/lib/review/replies";
import type { Finding, RepoConfig } from "@/lib/db/types";
import type { ReviewComment } from "@/lib/github/replies";
import type { AIProvider } from "@/lib/ai/provider";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    path: "src/a.ts",
    line: 10,
    severity: "major",
    category: "bug",
    comment: "possible null deref",
    blocking: true,
    posted: true,
    ...overrides,
  };
}

function botComment(id: number, path: string, line: number): ReviewComment {
  return {
    id,
    path,
    line,
    body: "bot finding",
    user: { login: "bot" },
    created_at: "2026-01-01T00:00:00Z",
  };
}

function reply(
  id: number,
  inReplyTo: number,
  login: string,
  createdAt: string,
  body = "reply",
): ReviewComment {
  return {
    id,
    in_reply_to_id: inReplyTo,
    path: "src/a.ts",
    line: 10,
    body,
    user: { login },
    created_at: createdAt,
  };
}

const SINCE = new Date("2026-01-01T00:00:00Z");

describe("mapFindingsToReplies", () => {
  it("maps a finding to author replies via order + path/line", () => {
    const bundles = mapFindingsToReplies({
      findings: [finding()],
      botComments: [botComment(100, "src/a.ts", 10)],
      allComments: [reply(200, 100, "author", "2026-01-02T00:00:00Z")],
      botLogin: "bot",
      since: SINCE,
    });
    expect(bundles).toHaveLength(1);
    expect(bundles[0]?.commentId).toBe(100);
    expect(bundles[0]?.replies).toHaveLength(1);
  });

  it("ignores replies authored by the bot itself", () => {
    const bundles = mapFindingsToReplies({
      findings: [finding()],
      botComments: [botComment(100, "src/a.ts", 10)],
      allComments: [reply(200, 100, "bot", "2026-01-02T00:00:00Z")],
      botLogin: "bot",
      since: SINCE,
    });
    expect(bundles).toHaveLength(0);
  });

  it("ignores replies created before the since cutoff", () => {
    const bundles = mapFindingsToReplies({
      findings: [finding()],
      botComments: [botComment(100, "src/a.ts", 10)],
      allComments: [reply(200, 100, "author", "2025-12-31T00:00:00Z")],
      botLogin: "bot",
      since: SINCE,
    });
    expect(bundles).toHaveLength(0);
  });

  it("returns no bundle when a finding has no matching comment", () => {
    const bundles = mapFindingsToReplies({
      findings: [finding({ path: "src/z.ts" })],
      botComments: [botComment(100, "src/a.ts", 10)],
      allComments: [reply(200, 100, "author", "2026-01-02T00:00:00Z")],
      botLogin: "bot",
      since: SINCE,
    });
    expect(bundles).toHaveLength(0);
  });
});

const CONFIG: RepoConfig = {
  provider: null,
  model: null,
  reviewProfile: "chill",
  autoVerdict: true,
  confidenceThreshold: 0.6,
  customGuidelines: "",
  ignorePatterns: [],
  contextFiles: [],
  maxChunks: 3,
};

describe("computeReplyVerdict", () => {
  it("APPROVES when all blocking findings are resolved", () => {
    const result = computeReplyVerdict({
      findings: [finding({ blocking: true })],
      statuses: [{ index: 0, status: "resolved", note: "" }],
      config: CONFIG,
    });
    expect(result.verdict).toBe("APPROVE");
  });

  it("keeps REQUEST_CHANGES when a blocking finding is unresolved", () => {
    const result = computeReplyVerdict({
      findings: [finding({ blocking: true })],
      statuses: [{ index: 0, status: "unresolved", note: "" }],
      config: CONFIG,
    });
    expect(result.verdict).toBe("REQUEST_CHANGES");
  });

  it("returns COMMENT when a reply needs clarification", () => {
    const result = computeReplyVerdict({
      findings: [finding({ blocking: false })],
      statuses: [{ index: 0, status: "not_determinable", note: "" }],
      config: CONFIG,
    });
    expect(result.verdict).toBe("COMMENT");
  });

  it("respects autoVerdict=false with COMMENT", () => {
    const result = computeReplyVerdict({
      findings: [finding({ blocking: true })],
      statuses: [{ index: 0, status: "resolved", note: "" }],
      config: { ...CONFIG, autoVerdict: false },
    });
    expect(result.verdict).toBe("COMMENT");
    expect(result.forced).toBe("auto_verdict_off");
  });
});

function fakeProvider(responseText: string): AIProvider {
  return {
    name: "glm",
    complete: async () => ({
      text: responseText,
      usage: { promptTokens: 0, completionTokens: 0 },
    }),
  };
}

describe("evaluateReplies", () => {
  const bundles = mapFindingsToReplies({
    findings: [finding()],
    botComments: [botComment(100, "src/a.ts", 10)],
    allComments: [
      reply(200, 100, "author", "2026-01-02T00:00:00Z", "trust me it's fine"),
    ],
    botLogin: "bot",
    since: SINCE,
  });

  it("parses a valid AI JSON verdict", async () => {
    const provider = fakeProvider(
      '{"results":[{"index":0,"status":"unresolved","note":"no evidence"}]}',
    );
    const { statuses } = await evaluateReplies({
      bundles,
      prTitle: "feat",
      prIntentExplanation: "",
      provider,
      model: "glm-4.6",
    });
    expect(statuses[0]?.status).toBe("unresolved");
  });

  it("falls back to not_determinable on unparseable AI output", async () => {
    const provider = fakeProvider("not json at all");
    const { statuses } = await evaluateReplies({
      bundles,
      prTitle: "feat",
      prIntentExplanation: "",
      provider,
      model: "glm-4.6",
    });
    expect(statuses[0]?.status).toBe("not_determinable");
  });

  it("coerces an unknown status to not_determinable", async () => {
    const provider = fakeProvider(
      '{"results":[{"index":0,"status":"totally_fine","note":"x"}]}',
    );
    const { statuses } = await evaluateReplies({
      bundles,
      prTitle: "feat",
      prIntentExplanation: "",
      provider,
      model: "glm-4.6",
    });
    expect(statuses[0]?.status).toBe("not_determinable");
  });
});
