import type { RepoConfig } from "@/lib/db/types";

export interface RepoChanges {
  enabled?: boolean;
  config?: Partial<RepoConfig>;
}

/** The `$set` for a repo update: only the fields present are written. */
export function buildRepoSet(
  changes: RepoChanges,
  now: Date = new Date(),
): Record<string, unknown> {
  const set: Record<string, unknown> = { updatedAt: now };
  if (changes.enabled !== undefined) set.enabled = changes.enabled;
  for (const [key, value] of Object.entries(changes.config ?? {})) {
    if (value !== undefined) set[`config.${key}`] = value;
  }
  return set;
}

/** Number of fields a change would write, excluding the timestamp. */
export function countChanges(changes: RepoChanges): number {
  return Object.keys(buildRepoSet(changes)).length - 1;
}
