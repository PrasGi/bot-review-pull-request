import { PROVIDER_LABEL } from "@/lib/ai/provider-labels";
import { PROFILE_META } from "@/lib/prompts/profile-meta";
import type { RepoChanges } from "@/lib/repos/update";

// Every string of the repo filters and bulk configure. Tests assert against these.

const plural = (n: number): string => `${n} ${n === 1 ? "repository" : "repositories"}`;

export const REPO_FILTER_COPY = {
  account: "Account",
  status: "Status",
  character: "Character",
  model: "Model",
  any: "All",
  statuses: { enabled: "Enabled", disabled: "Disabled", removed: "Removed" },
  clear: "Clear filters",
  noMatch: "No repositories match",
  noMatchHint: "Try a different search term or clear the filters.",
} as const;

export const BULK_COPY = {
  selected: (n: number) => `${n} selected`,
  selectPage: "Select all on this page",
  selectAll: (n: number) => `Select all ${n} matching`,
  clear: "Clear selection",
  open: "Bulk configure",
  title: (n: number) => `Configure ${plural(n)}`,
  description:
    "Tick a field to change it. Fields you leave unticked keep each repository's current value. Lists replace the old list.",
  change: (field: string) => `Change ${field.toLowerCase()}`,
  review: "Review changes",
  nothing: "Tick at least one field to change.",
  cancel: "Cancel",
  applied: (n: number) => `Updated ${plural(n)}.`,
  partial: (done: number, total: number) =>
    `Updated ${done} of ${total}. The rest were removed from their installation.`,
  failed: "Could not update the repositories.",
  fields: {
    enabled: "Reviews",
    reviewProfile: "Character",
    model: "Provider and model",
    autoVerdict: "Auto verdict",
    maxChunks: "Max chunks",
    customGuidelines: "Custom guidelines",
    ignorePatterns: "Ignore patterns",
    authorProfiles: "Per-author overrides",
  },
  authorHint: "One per line: username = profile, e.g. aziz-yoco = chill. Leave empty to remove all overrides.",
} as const;

export const BULK_CONFIRM_COPY = {
  title: (n: number) => `Update ${plural(n)}?`,
  description: (lines: string[]) =>
    `This overwrites the current value on every selected repository: ${lines.join(" · ")}.`,
  cancel: "Keep editing",
  confirm: (n: number) => `Update ${plural(n)}`,
} as const;

/** One short line per changed field, for the confirmation. */
export function describeChanges(changes: RepoChanges): string[] {
  const f = BULK_COPY.fields;
  const c = changes.config ?? {};
  const lines: string[] = [];
  if (changes.enabled !== undefined) lines.push(`${f.enabled} ${changes.enabled ? "on" : "off"}`);
  if (c.reviewProfile) lines.push(`${f.reviewProfile} → ${PROFILE_META[c.reviewProfile].label}`);
  if ("provider" in c || "model" in c) {
    lines.push(
      c.provider == null && c.model == null
        ? `${f.model} → default`
        : `${f.model} → ${c.provider ? PROVIDER_LABEL[c.provider] : "default"} · ${c.model ?? "default"}`,
    );
  }
  if (c.autoVerdict !== undefined) lines.push(`${f.autoVerdict} ${c.autoVerdict ? "on" : "off"}`);
  if (c.maxChunks !== undefined) lines.push(`${f.maxChunks} → ${c.maxChunks}`);
  if (c.customGuidelines !== undefined) {
    lines.push(c.customGuidelines ? `${f.customGuidelines} replaced` : `${f.customGuidelines} cleared`);
  }
  if (c.ignorePatterns) lines.push(`${f.ignorePatterns} → ${c.ignorePatterns.length} ${c.ignorePatterns.length === 1 ? "pattern" : "patterns"}`);
  if (c.authorProfiles) lines.push(`${f.authorProfiles} → ${c.authorProfiles.length} ${c.authorProfiles.length === 1 ? "rule" : "rules"}`);
  return lines;
}
