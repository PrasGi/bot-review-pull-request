import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

const reviewProfileSchema = z.enum([
  "chill",
  "normal",
  "professional",
  "expert",
]);

// GitHub logins: alphanumeric and single hyphens, max 39 chars.
export const authorProfileRuleSchema = z.object({
  login: z
    .string()
    .min(1)
    .max(39)
    .regex(/^[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/, "invalid GitHub username"),
  profile: reviewProfileSchema,
});
export type AuthorProfileRuleInput = z.infer<typeof authorProfileRuleSchema>;

export const inviteCreateSchema = z.object({
  targetLogin: authorProfileRuleSchema.shape.login,
  reviewerConnectionId: z.string().regex(/^[a-f\d]{24}$/i, "invalid id"),
});
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;

export const repoConfigSchema = z.object({
  provider: z.enum(["anthropic", "openai", "glm", "kimi"]).nullable(),
  model: z.string().nullable(),
  reviewProfile: reviewProfileSchema,
  authorProfiles: z.array(authorProfileRuleSchema).max(50),
  autoVerdict: z.boolean(),
  customGuidelines: z.string().max(2000),
  ignorePatterns: z.array(z.string().max(200)).max(50),
  contextFiles: z.array(z.string().max(300)).max(20),
  maxChunks: z.number().int().min(1).max(84),
});
export type RepoConfigInput = z.infer<typeof repoConfigSchema>;

export const repoUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  config: repoConfigSchema.partial().optional(),
});
export type RepoUpdateInput = z.infer<typeof repoUpdateSchema>;

export const MAX_BULK_REPOS = 500;

// Every field is optional: only the ones sent are written to every repo.
export const repoBulkUpdateSchema = z
  .object({
    ids: z
      .array(z.string().regex(/^[a-f\d]{24}$/i, "invalid id"))
      .min(1)
      .max(MAX_BULK_REPOS),
    enabled: z.boolean().optional(),
    config: repoConfigSchema.partial().optional(),
  })
  .refine(
    (d) => d.enabled !== undefined || Object.keys(d.config ?? {}).length > 0,
    { message: "Nothing to update" },
  )
  .refine(
    (d) => ("provider" in (d.config ?? {})) === ("model" in (d.config ?? {})),
    { message: "provider and model are changed together", path: ["config"] },
  );
export type RepoBulkUpdateInput = z.infer<typeof repoBulkUpdateSchema>;

export const settingsUpdateSchema = z.object({
  defaultProvider: z.enum(["anthropic", "openai", "glm", "kimi"]).optional(),
  defaultModel: z.string().min(1).optional(),
  defaultReviewProfile: z
    .enum(["chill", "normal", "professional", "expert"])
    .optional(),
  dailyCostAlertUsd: z.number().min(0).nullable().optional(),
  providerKeys: z
    .record(z.enum(["anthropic", "openai", "glm", "kimi"]), z.string().min(1))
    .optional(),
  modelPricing: z
    .array(
      z.object({
        provider: z.enum(["anthropic", "openai", "glm", "kimi"]),
        model: z.string().min(1),
        inputPerM: z.number().min(0),
        outputPerM: z.number().min(0),
      }),
    )
    .optional(),
});
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

export const REQUEST_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "skipped_draft",
  "superseded",
] as const;

export const requestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(REQUEST_STATUSES).optional(),
  repoId: z.string().optional(),
  search: z.string().max(200).optional(),
});
export type RequestsQuery = z.infer<typeof requestsQuerySchema>;

export const usageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  groupBy: z.enum(["model", "repo", "day"]).default("day"),
});
export type UsageQuery = z.infer<typeof usageQuerySchema>;
