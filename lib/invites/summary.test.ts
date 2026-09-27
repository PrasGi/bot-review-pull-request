import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import type { InstallationDoc, RepoConfig, RepoDoc } from "@/lib/db/types";
import { buildConnectionSummary } from "@/lib/invites/summary";
import { PROFILE_META } from "@/lib/prompts/profile-meta";

const now = new Date("2026-09-27T00:00:00Z");

const installation: InstallationDoc = {
  _id: new ObjectId(),
  installationId: 42,
  accountType: "Organization",
  accountLogin: "YoCoApp",
  accountId: 1,
  repositorySelection: "selected",
  createdAt: now,
  updatedAt: now,
};

function config(overrides: Partial<RepoConfig> = {}): RepoConfig {
  return {
    provider: null,
    model: null,
    reviewProfile: "chill",
    authorProfiles: [],
    autoVerdict: true,
    customGuidelines: "",
    ignorePatterns: [],
    contextFiles: [],
    maxChunks: 84,
    ...overrides,
  };
}

function repo(fullName: string, overrides: Partial<RepoDoc> = {}): RepoDoc {
  return {
    _id: new ObjectId(),
    installationRef: installation._id,
    installationId: 42,
    fullName,
    repoGithubId: 1,
    enabled: true,
    config: config(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

type SummaryInput = Parameters<typeof buildConnectionSummary>[0];

const settings = { defaultProvider: "glm" as const, defaultModel: "glm-5.2" };
const reviewer = { githubLogin: "prasetyo", installationIds: [42], reconnectRequired: false };

describe("buildConnectionSummary", () => {
  it("inherits the global model and marks it as the default", () => {
    const { rows, activeCount } = buildConnectionSummary({
      repos: [repo("YoCoApp/yoco-lib")],
      installation,
      settings,
      reviewer,
    });
    expect(activeCount).toBe(1);
    expect(rows[0]).toMatchObject({
      active: true,
      reason: null,
      provider: "glm",
      providerLabel: "GLM",
      model: "glm-5.2",
      modelIsDefault: true,
    });
    expect(rows[0].character).toMatchObject({
      profile: "chill",
      label: PROFILE_META.chill.label,
      description: PROFILE_META.chill.description,
      limits: "Up to 5 findings, major and above.",
    });
  });

  it("uses the repo override and lists per-author characters", () => {
    const { rows } = buildConnectionSummary({
      repos: [
        repo("YoCoApp/engineering", {
          config: config({
            provider: "anthropic",
            model: "claude-sonnet-5",
            reviewProfile: "expert",
            authorProfiles: [{ login: "aziz-yoco", profile: "chill" }],
          }),
        }),
      ],
      installation,
      settings,
      reviewer,
    });
    expect(rows[0]).toMatchObject({
      provider: "anthropic",
      model: "claude-sonnet-5",
      modelIsDefault: false,
    });
    expect(rows[0].character.limits).toBe("Up to 40 findings, nit and above.");
    expect(rows[0].authorOverrides).toEqual([
      { login: "aziz-yoco", character: expect.objectContaining({ profile: "chill" }) },
    ]);
  });

  it("drops removed repos and sorts by name", () => {
    const { rows } = buildConnectionSummary({
      repos: [
        repo("YoCoApp/yoco-mobile-app"),
        repo("YoCoApp/gone", { removedFromInstallation: true }),
        repo("YoCoApp/engineering"),
      ],
      installation,
      settings,
      reviewer,
    });
    expect(rows.map((r) => r.fullName)).toEqual([
      "YoCoApp/engineering",
      "YoCoApp/yoco-mobile-app",
    ]);
  });

  it.each([
    ["installation_inactive", { installation: { ...installation, suspendedAt: now } }],
    ["installation_inactive", { installation: null }],
    ["repo_disabled", { repos: [repo("YoCoApp/x", { enabled: false })] }],
    ["reviewer_missing", { reviewer: null }],
    ["reviewer_reconnect_required", { reviewer: { ...reviewer, reconnectRequired: true } }],
    ["reviewer_not_linked", { reviewer: { ...reviewer, installationIds: [7] } }],
    ["no_model", { settings: null }],
  ] as [string, Partial<SummaryInput>][])("reports %s", (reason, overrides) => {
    const { rows, activeCount } = buildConnectionSummary({
      repos: [repo("YoCoApp/x")],
      installation,
      settings,
      reviewer,
      ...overrides,
    });
    expect(activeCount).toBe(0);
    expect(rows[0]).toMatchObject({ active: false, reason });
  });
});
