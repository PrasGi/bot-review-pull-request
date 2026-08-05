import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("pr_reviewer"),

  // Required only for GitHub-facing flows (webhook, OAuth). Not needed by seed
  // or health checks, so presence is enforced at use via requireGithubEnv().
  GITHUB_APP_ID: z.string().default(""),
  GITHUB_APP_SLUG: z.string().default(""),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  GITHUB_WEBHOOK_SECRET: z.string().default(""),

  // AES-256-GCM requires a 32-byte key; base64 of 32 bytes is 44 chars.
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(44, "TOKEN_ENCRYPTION_KEY must be base64 of 32 bytes (>=44 chars)"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be >=32 chars"),

  APP_URL: z.url().default("http://localhost:3000"),

  // Secures the Vercel cron rollup endpoint. Optional locally; set in production.
  CRON_SECRET: z.string().default(""),

  // Optional in env: providers may instead be configured (encrypted) via the
  // dashboard settings. Presence is enforced at review time, not at boot.
  GLM_API_KEY: z.string().optional(),
  // Coding Plan endpoint: flat subscription, measured at ~5x real concurrency.
  // Its terms restrict the quota to interactive IDE tools and forbid invoking
  // it from "your own applications, bots, ... or other systems", with account
  // bans after repeated violations — an accepted, deliberate risk here.
  // Switch to https://api.z.ai/api/paas/v4/ (pay-per-token, needs a prepaid
  // balance) to run compliant; the same API key works on both.
  GLM_BASE_URL: z.string().default("https://api.z.ai/api/coding/paas/v4/"),
  KIMI_API_KEY: z.string().optional(),
  KIMI_BASE_URL: z.string().default("https://api.moonshot.ai/v1"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

const GITHUB_ENV_KEYS = [
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_WEBHOOK_SECRET",
] as const;

export function requireGithubEnv(): void {
  const env = getEnv();
  const missing = GITHUB_ENV_KEYS.filter((key) => env[key].length === 0);
  if (missing.length > 0) {
    throw new Error(
      `Missing GitHub App configuration: ${missing.join(", ")}. See docs/setup.md.`,
    );
  }
}
