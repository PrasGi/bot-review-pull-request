import { z } from "zod";

// Models are verbose and often overshoot length hints. Truncate rather than
// reject — a long summary must never fail an otherwise-valid review.
function cappedString(max: number): z.ZodType<string> {
  return z
    .string()
    .transform((s) => (s.length > max ? s.slice(0, max) : s));
}

// Models sometimes return confidence on a 0-100 scale instead of 0-1.
const confidenceSchema = z
  .number()
  .transform((n) => (n > 1 ? n / 100 : n))
  .pipe(z.number().min(0).max(1));

export const findingSchema = z.object({
  path: z.string().min(1),
  line: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
  severity: z.enum(["critical", "major", "minor", "nit"]),
  category: z.enum([
    "bug",
    "security",
    "performance",
    "maintainability",
    "test",
    "scope",
  ]),
  comment: cappedString(1500),
  suggestion: cappedString(2000).optional(),
  blocking: z.boolean().default(false),
});

export const intentMatchSchema = z.object({
  status: z.enum(["match", "partial", "mismatch"]),
  // Models routinely send {"status":"match"} with no explanation. The parent
  // being .optional() does not make this optional, so a missing string here
  // used to reject the whole chunk and fail the entire review.
  explanation: cappedString(400).default(""),
});

// Models occasionally rename "comment" to a near-synonym (seen from GLM:
// "breakdown"). Recover it before validation instead of dropping the whole
// finding for a naming slip.
const COMMENT_ALIASES = ["breakdown"] as const;

function withCommentAlias(item: unknown): unknown {
  if (typeof item !== "object" || item === null || "comment" in item) {
    return item;
  }
  const record = item as Record<string, unknown>;
  const alias = COMMENT_ALIASES.find((key) => typeof record[key] === "string");
  return alias ? { ...record, comment: record[alias] } : item;
}

// Drop malformed findings (missing path, non-positive line, etc.) instead of
// failing the whole review — a general remark with no location is not fatal.
// But losing EVERY finding is not leniency, it is a silent review: the model
// reported problems and we would forward "no issues" to the verdict step,
// which reads that as APPROVE. An originally empty array is a real clean PR
// and stays valid; only all-dropped is fatal.
const lenientFindings = z
  .array(z.unknown())
  .transform((items, ctx) => {
    const kept = items
      .map((item) => findingSchema.safeParse(withCommentAlias(item)))
      .filter((r) => r.success)
      .map((r) => r.data);
    if (items.length > 0 && kept.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: `all ${items.length} findings were malformed`,
      });
      return z.NEVER;
    }
    return kept;
  });

// `findings` stays required and must be an array: it is the proof that the
// model actually produced a review. Salvaging a response without it would turn
// an unparseable answer into "zero findings", which the verdict step reads as
// APPROVE — a silent false approval is far worse than a visible failure.
// Every other field here is descriptive, so a malformed one is dropped rather
// than allowed to reject the chunk.
export const chunkReviewSchema = z.object({
  findings: lenientFindings,
  chunkSummary: cappedString(600).default("").catch(""),
  intentNotes: cappedString(300).optional().catch(undefined),
  summary: cappedString(400).optional().catch(undefined),
  verdict: z
    .enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"])
    .optional()
    .catch(undefined),
  confidence: confidenceSchema.optional().catch(undefined),
  verdictReason: cappedString(400).optional().catch(undefined),
  intentMatch: intentMatchSchema.optional().catch(undefined),
});

const SALVAGEABLE_KEYS = [
  "intentNotes",
  "summary",
  "verdict",
  "confidence",
  "verdictReason",
  "intentMatch",
] as const;

// Salvaging keeps reviews alive but makes the damage invisible: the parse now
// succeeds, so the audit row reads "ok" and nobody notices a model that has
// started emitting malformed fields on every call. This reports what was
// quietly discarded so it can be recorded alongside the successful call.
export function describeChunkSalvage(
  raw: unknown,
  output: ChunkReviewOutput,
): string[] {
  if (typeof raw !== "object" || raw === null) return [];
  const json = raw as Record<string, unknown>;

  const notes = SALVAGEABLE_KEYS.filter(
    (key) => key in json && output[key] === undefined,
  ).map((key) => `dropped malformed "${key}"`);

  const rawFindings = json.findings;
  if (Array.isArray(rawFindings) && rawFindings.length > output.findings.length) {
    notes.push(
      `dropped ${rawFindings.length - output.findings.length} of ${rawFindings.length} findings`,
    );
  }

  return notes;
}

export const verdictSchema = z.object({
  summary: cappedString(1200),
  verdict: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  confidence: confidenceSchema,
  verdictReason: cappedString(400),
  intentMatch: intentMatchSchema,
});

export type FindingOutput = z.infer<typeof findingSchema>;
export type ChunkReviewOutput = z.infer<typeof chunkReviewSchema>;
export type VerdictOutput = z.infer<typeof verdictSchema>;
export type IntentMatchOutput = z.infer<typeof intentMatchSchema>;
