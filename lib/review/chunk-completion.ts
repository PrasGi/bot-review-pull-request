import type {
  AICompletion,
  AICompletionParams,
  AIMessage,
  AIProvider,
  AIUsage,
} from "@/lib/ai/provider";
import {
  chunkReviewSchema,
  describeChunkSalvage,
  type ChunkReviewOutput,
} from "@/lib/review/schemas";

export interface ParsedChunk {
  output: ChunkReviewOutput;
  salvageNotes: string[];
}

export interface ChunkAttemptAudit {
  purpose: "chunk-review" | "repair";
  messages: AIMessage[];
  response: string;
  usage: AIUsage;
  latencyMs: number;
  status: "ok" | "error";
  errorMessage?: string;
}

export function parseChunkOutput(raw: string): ParsedChunk {
  const json: unknown = JSON.parse(raw);
  const output = chunkReviewSchema.parse(json);
  return { output, salvageNotes: describeChunkSalvage(json, output) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function reportedFindings(raw: string): number | undefined {
  try {
    const json: unknown = JSON.parse(raw);
    if (typeof json !== "object" || json === null || !("findings" in json)) {
      return undefined;
    }
    return Array.isArray(json.findings) ? json.findings.length : undefined;
  } catch {
    return undefined;
  }
}

function repairMessages(
  messages: AIMessage[],
  response: string,
  parseError: string,
): AIMessage[] {
  return [
    ...messages,
    { role: "assistant", content: response },
    {
      role: "user",
      content: [
        "Your previous response was not valid JSON matching the review schema.",
        `Validation error: ${parseError.slice(0, 1200)}`,
        "Return the complete corrected JSON object. Preserve the review and every finding; only correct the format or required fields.",
        "Escape quotes and backslashes inside strings. Do not use trailing commas, markdown fences, or prose outside JSON.",
      ].join("\n"),
    },
  ];
}

export async function completeChunkWithRepair(params: {
  provider: AIProvider;
  completionParams: AICompletionParams;
  repairDeadlineAt: number;
  audit: (attempt: ChunkAttemptAudit) => Promise<void>;
}): Promise<ParsedChunk> {
  const attempt = async (
    purpose: ChunkAttemptAudit["purpose"],
    completionParams: AICompletionParams,
    requireFinding: boolean = false,
  ): Promise<{ completion: AICompletion; parsed?: ParsedChunk; parseError?: string }> => {
    const started = Date.now();
    let completion: AICompletion;
    try {
      completion = await params.provider.complete(completionParams);
    } catch (error) {
      await params.audit({
        purpose,
        messages: completionParams.messages,
        response: "",
        usage: { promptTokens: 0, completionTokens: 0 },
        latencyMs: Date.now() - started,
        status: "error",
        errorMessage: errorMessage(error),
      });
      throw error;
    }

    let parsed: ParsedChunk | undefined;
    let parseError: string | undefined;
    try {
      parsed = parseChunkOutput(completion.text);
      if (requireFinding && parsed.output.findings.length === 0) {
        throw new Error("repair dropped every finding from the original response");
      }
    } catch (error) {
      parsed = undefined;
      parseError = errorMessage(error);
    }

    await params.audit({
      purpose,
      messages: completionParams.messages,
      response: completion.text,
      usage: completion.usage,
      latencyMs: Date.now() - started,
      status: parsed ? "ok" : "error",
      errorMessage: parseError ?? (parsed?.salvageNotes.length
        ? `salvaged: ${parsed.salvageNotes.join("; ")}`
        : undefined),
    });
    return { completion, parsed, parseError };
  };

  const first = await attempt("chunk-review", params.completionParams);
  if (first.parsed) return first.parsed;
  if (Date.now() >= params.repairDeadlineAt) {
    throw new Error(first.parseError ?? "invalid chunk response");
  }

  const repaired = await attempt(
    "repair",
    {
      ...params.completionParams,
      messages: repairMessages(
        params.completionParams.messages,
        first.completion.text,
        first.parseError ?? "invalid chunk response",
      ),
      thinking: "disabled",
    },
    (reportedFindings(first.completion.text) ?? 0) > 0,
  );
  if (repaired.parsed) return repaired.parsed;
  throw new Error(
    `repair failed: ${repaired.parseError ?? "invalid chunk response"} (original: ${first.parseError ?? "invalid chunk response"})`,
  );
}
