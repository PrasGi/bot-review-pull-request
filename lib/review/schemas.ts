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
});

export const intentMatchSchema = z.object({
  status: z.enum(["match", "partial", "mismatch"]),
  explanation: cappedString(400),
});

// Drop malformed findings (missing path, non-positive line, etc.) instead of
// failing the whole review — a general remark with no location is not fatal.
const lenientFindings = z
  .array(z.unknown())
  .transform((items) =>
    items
      .map((item) => findingSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data),
  );

export const chunkReviewSchema = z.object({
  findings: lenientFindings,
  chunkSummary: cappedString(600),
  intentNotes: cappedString(300).optional(),
  summary: cappedString(1200).optional(),
  verdict: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).optional(),
  confidence: confidenceSchema.optional(),
  verdictReason: cappedString(400).optional(),
  intentMatch: intentMatchSchema.optional(),
});

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
