import type { ObjectId } from "mongodb";
import {
  installationsCollection,
  userConnectionsCollection,
  reposCollection,
} from "@/lib/db/collections";
import type { RepoConfig } from "@/lib/db/types";
import { encrypt } from "@/lib/crypto";
import type { GitHubTokenSet } from "@/lib/github/oauth";
import {
  fetchAuthenticatedUser,
  fetchUserInstallations,
  fetchInstallationRepos,
  type GitHubInstallation,
  type GitHubRepo,
} from "@/lib/github/api";

export function defaultRepoConfig(): RepoConfig {
  return {
    provider: null,
    model: null,
    reviewProfile: "normal",
    autoVerdict: true,
    confidenceThreshold: 0.6,
    customGuidelines: "",
    ignorePatterns: [],
    contextFiles: [],
    maxChunks: 3,
  };
}

export async function upsertInstallation(
  installation: GitHubInstallation,
  selection: "all" | "selected",
): Promise<ObjectId> {
  const installations = await installationsCollection();
  const now = new Date();
  const result = await installations.findOneAndUpdate(
    { installationId: installation.id },
    {
      $set: {
        accountType: installation.account?.type ?? "User",
        accountLogin: installation.account?.login ?? "",
        accountId: installation.account?.id ?? 0,
        repositorySelection: selection,
        updatedAt: now,
      },
      $setOnInsert: { installationId: installation.id, createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!result) throw new Error("Failed to upsert installation");
  return result._id;
}

export async function upsertRepos(
  installationRef: ObjectId,
  installationId: number,
  repos: GitHubRepo[],
): Promise<void> {
  const collection = await reposCollection();
  const now = new Date();
  for (const repo of repos) {
    await collection.updateOne(
      { fullName: repo.full_name },
      {
        $set: {
          installationRef,
          installationId,
          fullName: repo.full_name,
          repoGithubId: repo.id,
          removedFromInstallation: false,
          updatedAt: now,
        },
        $setOnInsert: {
          enabled: true,
          config: defaultRepoConfig(),
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }
}

export async function connectUser(tokens: GitHubTokenSet): Promise<{
  githubLogin: string;
  installationCount: number;
  repoCount: number;
}> {
  const user = await fetchAuthenticatedUser(tokens.accessToken);
  const installations = await fetchUserInstallations(tokens.accessToken);

  let repoCount = 0;
  for (const installation of installations) {
    const { selection, repos } = await fetchInstallationRepos(
      tokens.accessToken,
      installation.id,
    );
    const ref = await upsertInstallation(installation, selection);
    await upsertRepos(ref, installation.id, repos);
    repoCount += repos.length;
  }

  const userConnections = await userConnectionsCollection();
  const now = new Date();
  await userConnections.updateOne(
    { githubUserId: user.id },
    {
      $set: {
        githubLogin: user.login,
        displayName: user.name ?? user.login,
        avatarUrl: user.avatar_url,
        userTokenEncrypted: encrypt(tokens.accessToken),
        tokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        installationIds: installations.map((i) => i.id),
        reconnectRequired: false,
        updatedAt: now,
      },
      $setOnInsert: { githubUserId: user.id, createdAt: now },
    },
    { upsert: true },
  );

  return {
    githubLogin: user.login,
    installationCount: installations.length,
    repoCount,
  };
}
