import { z } from "zod";

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
  comment: z.string().min(10).max(1500),
  suggestion: z.string().max(2000).optional(),
});

export const intentMatchSchema = z.object({
  status: z.enum(["match", "partial", "mismatch"]),
  explanation: z.string().max(400),
});

export const chunkReviewSchema = z.object({
  findings: z.array(findingSchema),
  chunkSummary: z.string().max(600),
  intentNotes: z.string().max(300).optional(),
  summary: z.string().max(1200).optional(),
  verdict: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  verdictReason: z.string().max(400).optional(),
  intentMatch: intentMatchSchema.optional(),
});

export const verdictSchema = z.object({
  summary: z.string().max(1200),
  verdict: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  confidence: z.number().min(0).max(1),
  verdictReason: z.string().max(400),
  intentMatch: intentMatchSchema,
});

export type FindingOutput = z.infer<typeof findingSchema>;
export type ChunkReviewOutput = z.infer<typeof chunkReviewSchema>;
export type VerdictOutput = z.infer<typeof verdictSchema>;
export type IntentMatchOutput = z.infer<typeof intentMatchSchema>;
