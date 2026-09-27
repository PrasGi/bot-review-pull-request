import type { AIProviderName, ReviewProfile } from "@/lib/db/types";
import { PROVIDER_LABEL } from "@/lib/ai/provider-labels";
import { PROFILE_META, REVIEW_PROFILES } from "@/lib/prompts/profile-meta";

// Client-safe: the Projects page filters in the browser.

export type RepoStatusFilter = "enabled" | "disabled" | "removed";

export interface RepoFilter {
  q: string;
  account: string;
  status: RepoStatusFilter | "";
  profile: ReviewProfile | "";
  /** "" = any, "default" = inherits both, else a modelKey(). */
  model: string;
}

export interface FilterableRepo {
  fullName: string;
  accountLogin: string;
  enabled: boolean;
  removedFromInstallation: boolean;
  config: {
    provider: AIProviderName | null;
    model: string | null;
    reviewProfile: ReviewProfile;
  };
}

export const EMPTY_FILTER: RepoFilter = {
  q: "",
  account: "",
  status: "",
  profile: "",
  model: "",
};

const STATUSES: RepoStatusFilter[] = ["enabled", "disabled", "removed"];

/** Reads the filter from the URL; unknown values fall back to "any". */
export function parseRepoFilter(params: URLSearchParams): RepoFilter {
  const status = params.get("status") ?? "";
  const profile = params.get("profile") ?? "";
  return {
    q: params.get("q") ?? "",
    account: params.get("account") ?? "",
    status: (STATUSES as string[]).includes(status) ? (status as RepoStatusFilter) : "",
    profile: (REVIEW_PROFILES as string[]).includes(profile) ? (profile as ReviewProfile) : "",
    model: params.get("model") ?? "",
  };
}

export function hasActiveFilter(filter: RepoFilter): boolean {
  return Object.values(filter).some((v) => v !== "");
}

export function repoStatus(repo: FilterableRepo): RepoStatusFilter {
  if (repo.removedFromInstallation) return "removed";
  return repo.enabled ? "enabled" : "disabled";
}

/** "default" when the repo inherits both, else "provider:model" with "default" for an inherited half. */
export function modelKey(config: FilterableRepo["config"]): string {
  if (config.provider === null && config.model === null) return "default";
  return `${config.provider ?? "default"}:${config.model ?? "default"}`;
}

export function modelLabel(key: string): string {
  if (key === "default") return "Default (inherit global)";
  const [provider, ...rest] = key.split(":");
  const model = rest.join(":");
  const providerLabel =
    provider === "default" ? "default provider" : (PROVIDER_LABEL[provider as AIProviderName] ?? provider);
  return `${providerLabel} · ${model === "default" ? "default model" : model}`;
}

export function filterRepos<T extends FilterableRepo>(repos: T[], filter: RepoFilter): T[] {
  const q = filter.q.trim().toLowerCase();
  return repos.filter(
    (repo) =>
      (!q || repo.fullName.toLowerCase().includes(q)) &&
      (!filter.account || repo.accountLogin === filter.account) &&
      (!filter.status || repoStatus(repo) === filter.status) &&
      (!filter.profile || repo.config.reviewProfile === filter.profile) &&
      (!filter.model || modelKey(repo.config) === filter.model),
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

/** Options built from the data, so a filter never offers a value with no repos. */
export function filterOptions(repos: FilterableRepo[]): {
  accounts: FilterOption[];
  models: FilterOption[];
  profiles: FilterOption[];
} {
  const accounts = [...new Set(repos.map((r) => r.accountLogin))].sort((a, b) => a.localeCompare(b));
  const models = [...new Set(repos.map((r) => modelKey(r.config)))].sort((a, b) =>
    a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b),
  );
  return {
    accounts: accounts.map((a) => ({ value: a, label: a })),
    models: models.map((m) => ({ value: m, label: modelLabel(m) })),
    profiles: REVIEW_PROFILES.map((p) => ({ value: p, label: PROFILE_META[p].label })),
  };
}
