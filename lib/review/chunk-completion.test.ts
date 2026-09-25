import { describe, expect, it, vi } from "vitest";
import type { AICompletionParams, AIProvider } from "@/lib/ai/provider";
import {
  completeChunkWithRepair,
  type ChunkAttemptAudit,
} from "@/lib/review/chunk-completion";

const completionParams: AICompletionParams = {
  model: "glm-5.3",
  messages: [
    { role: "system", content: "Return a JSON review." },
    { role: "user", content: "Review the diff." },
  ],
  maxTokens: 16_384,
  thinking: "enabled",
};

const validReview = JSON.stringify({
  findings: [],
  chunkSummary: "Looks good.",
});

function setup(...responses: (string | Error)[]) {
  const complete = vi.fn(async (_params: AICompletionParams) => {
    void _params;
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (next === undefined) throw new Error("unexpected call");
    return {
      text: next,
      usage: { promptTokens: 100, completionTokens: 50 },
    };
  });
  const audit = vi.fn(async (_attempt: ChunkAttemptAudit) => {
    void _attempt;
  });
  const provider: AIProvider = { name: "glm", complete };
  const run = (deadline = Date.now() + 60_000) =>
    completeChunkWithRepair({
      provider,
      completionParams,
      repairDeadlineAt: deadline,
      audit,
    });
  return { complete, audit, run };
}

describe("completeChunkWithRepair", () => {
  it("uses a valid response without an extra model call", async () => {
    const { complete, audit, run } = setup(validReview);

    expect((await run()).output.findings).toEqual([]);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "chunk-review", status: "ok" }),
    );
  });

  it("repairs malformed JSON using the original response and parse error", async () => {
    const malformed = '{"findings":[],"chunkSummary":"renames "graded arm""}';
    const { complete, audit, run } = setup(malformed, validReview);

    expect((await run()).output.chunkSummary).toBe("Looks good.");
    expect(complete).toHaveBeenCalledTimes(2);
    const repair = complete.mock.calls[1]?.[0];
    expect(repair?.thinking).toBe("disabled");
    expect(repair?.messages.at(-2)).toEqual({ role: "assistant", content: malformed });
    expect(repair?.messages.at(-1)?.content).toContain("Validation error:");
    expect(audit.mock.calls.map(([call]) => [call.purpose, call.status])).toEqual([
      ["chunk-review", "error"],
      ["repair", "ok"],
    ]);
    expect(audit.mock.calls[0]?.[0].response).toBe(malformed);
  });

  it.each([
    { name: "trailing comma", malformed: '{"findings":[],"chunkSummary":"ok",}' },
    { name: "unescaped regex", malformed: '{"findings":[],"chunkSummary":"/\\d+/"}' },
    { name: "missing colon", malformed: '{"findings":[],"chunkSummary" "ok"}' },
    { name: "incomplete object", malformed: '{"findings":[],"chunkSummary":"ok"' },
  ])("repairs $name from observed JSON failure patterns", async ({ malformed }) => {
    const { complete, run } = setup(malformed, validReview);

    expect((await run()).output.chunkSummary).toBe("Looks good.");
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("repairs valid JSON that fails schema validation without accepting missing findings", async () => {
    const invalidSchema = JSON.stringify({ chunkSummary: "No findings field" });
    const { complete, audit, run } = setup(invalidSchema, validReview);

    expect((await run()).output.findings).toEqual([]);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls[0]?.[0].errorMessage).toContain("findings");
  });

  it("rejects a second malformed response and audits both attempts", async () => {
    const { complete, audit, run } = setup("{", "{");

    await expect(run()).rejects.toThrow("repair failed:");
    expect(complete).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls.map(([call]) => call.status)).toEqual([
      "error",
      "error",
    ]);
  });

  it("does not start a repair after the retry deadline", async () => {
    const { complete, audit, run } = setup("{");

    await expect(run(Date.now() - 1)).rejects.toThrow();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it("does not treat a provider error as a parse error", async () => {
    const { complete, audit, run } = setup(new Error("429 Rate limit"));

    await expect(run()).rejects.toThrow("429 Rate limit");
    expect(complete).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "chunk-review",
        response: "",
        status: "error",
        errorMessage: "429 Rate limit",
      }),
    );
  });

  it("records a provider error during repair without another retry", async () => {
    const { complete, audit, run } = setup("{", new Error("repair timed out"));

    await expect(run()).rejects.toThrow("repair timed out");
    expect(complete).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls.map(([call]) => [call.purpose, call.status])).toEqual([
      ["chunk-review", "error"],
      ["repair", "error"],
    ]);
    expect(audit.mock.calls[1]?.[0].response).toBe("");
  });

  it("does not repair a safely salvaged response", async () => {
    const partial = JSON.stringify({
      findings: [
        {
          path: "src/a.ts",
          line: 1,
          severity: "major",
          category: "bug",
          comment: "Real issue",
        },
        { line: 0 },
      ],
    });
    const { complete, audit, run } = setup(partial);

    expect((await run()).output.findings).toHaveLength(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]?.[0].errorMessage).toBe(
      "salvaged: dropped 1 of 2 findings",
    );
  });

  it("rejects repair that converts reported findings into a clean review", async () => {
    const malformedFindings = JSON.stringify({ findings: [{ line: 0 }] });
    const { audit, run } = setup(malformedFindings, validReview);

    await expect(run()).rejects.toThrow(
      "repair dropped every finding from the original response",
    );
    expect(audit.mock.calls[1]?.[0].status).toBe("error");
  });

  it("keeps malformed findings fatal when repair cannot restore them", async () => {
    const malformedFindings = JSON.stringify({ findings: [{ line: 0 }] });
    const { audit, run } = setup(malformedFindings, malformedFindings);

    await expect(run()).rejects.toThrow("all 1 findings were malformed");
    expect(audit.mock.calls.map(([call]) => call.status)).toEqual([
      "error",
      "error",
    ]);
  });
});
