import { AI_PROVIDERS, PROVIDER_LABEL } from '@/lib/ai/provider-labels';
import { PROFILE_META, REVIEW_PROFILES } from '@/lib/prompts/profile-meta';
import type { AIProviderName, ReviewProfile } from '@/lib/db/types';

// Shared by the single-repo and bulk configure dialogs. Limits mirror
// repoConfigSchema in lib/schemas.

export const PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default (inherit global)' },
  ...AI_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABEL[p] })),
];

export const PROFILE_OPTIONS: { value: string; label: string }[] = REVIEW_PROFILES.map((profile) => ({
  value: profile,
  label: `${PROFILE_META[profile].label} — ${PROFILE_META[profile].tagline}`,
}));

export const MAX_AUTHOR_PROFILES = 50;
// GitHub logins are alphanumeric with single non-trailing hyphens, 1–39 chars.
export const GITHUB_LOGIN_RE = /^[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/;

// 84 chunks × 12k tokens ≈ the 1M total input budget (MAX_CHUNKS in lib/review/pipeline).
export const MIN_CHUNKS = 1;
export const MAX_CHUNKS = 84;
export const MAX_GUIDELINES = 2000;

export function isProviderValue(v: string): v is AIProviderName {
  return (AI_PROVIDERS as string[]).includes(v);
}

export function isReviewProfile(v: string): v is ReviewProfile {
  return (REVIEW_PROFILES as string[]).includes(v);
}

export function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function validateIgnorePatterns(lines: string[]): string | null {
  if (lines.length > 50) return 'Ignore patterns: at most 50 entries allowed';
  const long = lines.find((l) => l.length > 200);
  if (long) return `Ignore pattern too long (max 200 chars): "${long.slice(0, 40)}…"`;
  return null;
}

export function validateContextFiles(lines: string[]): string | null {
  if (lines.length > 20) return 'Context files: at most 20 entries allowed';
  const long = lines.find((l) => l.length > 300);
  if (long) return `Context file path too long (max 300 chars): "${long.slice(0, 40)}…"`;
  return null;
}

export function validateAuthorLogins(logins: string[]): string | null {
  if (logins.length > MAX_AUTHOR_PROFILES) return `Author overrides: at most ${MAX_AUTHOR_PROFILES} entries allowed`;
  const bad = logins.find((l) => !GITHUB_LOGIN_RE.test(l));
  if (bad) return `Invalid GitHub username: "${bad.slice(0, 40)}"`;
  return null;
}

export function validateGuidelines(text: string): string | null {
  return text.length > MAX_GUIDELINES ? `Custom guidelines must be at most ${MAX_GUIDELINES} characters` : null;
}

export function validateMaxChunks(value: number): string | null {
  return value < MIN_CHUNKS || value > MAX_CHUNKS ? `Max chunks must be between ${MIN_CHUNKS} and ${MAX_CHUNKS}` : null;
}
