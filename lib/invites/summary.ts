import type {
  AIProviderName,
  InstallationDoc,
  RepoDoc,
  ReviewProfile,
  SettingsDoc,
  UserConnectionDoc,
} from "@/lib/db/types";
import { PROVIDER_LABEL } from "@/lib/ai/provider-labels";
import { PROFILE_KNOBS } from "@/lib/prompts/defaults";
import { PROFILE_META } from "@/lib/prompts/profile-meta";

export type InactiveReason =
  | "installation_inactive"
  | "repo_disabled"
  | "reviewer_missing"
  | "reviewer_reconnect_required"
  | "reviewer_not_linked"
  | "no_model";

export interface CharacterSummary {
  profile: ReviewProfile;
  label: string;
  description: string;
  limits: string;
}

export interface ConnectedRepoRow {
  fullName: string;
  active: boolean;
  /** The first blocking reason, in the order a review would hit it. */
  reason: InactiveReason | null;
  provider: AIProviderName | null;
  providerLabel: string | null;
  model: string | null;
  modelIsDefault: boolean;
  character: CharacterSummary;
  authorOverrides: { login: string; character: CharacterSummary }[];
}

export interface ConnectionSummary {
  rows: ConnectedRepoRow[];
  activeCount: number;
}

/** "Up to 5 findings, major and above." */
export function profileLimits(profile: ReviewProfile): string {
  const knobs = PROFILE_KNOBS[profile];
  return `Up to ${knobs.maxFindings} findings, ${knobs.severityFloor} and above.`;
}

function character(profile: ReviewProfile): CharacterSummary {
  const meta = PROFILE_META[profile];
  return {
    profile,
    label: meta.label,
    description: meta.description,
    limits: profileLimits(profile),
  };
}

type Reviewer = Pick<
  UserConnectionDoc,
  "githubLogin" | "installationIds" | "reconnectRequired"
>;

/** Mirrors the checks in lib/webhook/tenant.ts so "active" means a review would run. */
function blockingReason(
  repo: RepoDoc,
  installation: InstallationDoc | null,
  reviewer: Reviewer | null,
  model: string | null,
): InactiveReason | null {
  if (!installation || installation.suspendedAt || installation.deletedAt) {
    return "installation_inactive";
  }
  if (!repo.enabled) return "repo_disabled";
  if (!reviewer) return "reviewer_missing";
  if (reviewer.reconnectRequired) return "reviewer_reconnect_required";
  if (!reviewer.installationIds.includes(repo.installationId)) {
    return "reviewer_not_linked";
  }
  if (!model) return "no_model";
  return null;
}

/** Model resolution follows lib/ai/factory.ts#resolveModel: repo override, else the global default. */
export function buildConnectionSummary(input: {
  repos: RepoDoc[];
  installation: InstallationDoc | null;
  settings: Pick<SettingsDoc, "defaultProvider" | "defaultModel"> | null;
  reviewer: Reviewer | null;
}): ConnectionSummary {
  const rows = input.repos
    .filter((repo) => !repo.removedFromInstallation)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((repo): ConnectedRepoRow => {
      const provider = repo.config.provider ?? input.settings?.defaultProvider ?? null;
      const model = repo.config.model ?? input.settings?.defaultModel ?? null;
      const reason = blockingReason(repo, input.installation, input.reviewer, model);
      return {
        fullName: repo.fullName,
        active: reason === null,
        reason,
        provider,
        providerLabel: provider ? PROVIDER_LABEL[provider] : null,
        model,
        modelIsDefault: repo.config.model === null,
        character: character(repo.config.reviewProfile),
        authorOverrides: (repo.config.authorProfiles ?? []).map((rule) => ({
          login: rule.login,
          character: character(rule.profile),
        })),
      };
    });
  return { rows, activeCount: rows.filter((r) => r.active).length };
}
