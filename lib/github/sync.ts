import type { ObjectId } from "mongodb";
import {
  installationsCollection,
  userConnectionsCollection,
  reposCollection,
} from "@/lib/db/collections";
import type { RepoConfig } from "@/lib/db/types";
import { encrypt } from "@/lib/crypto";
import { getValidAccessToken } from "@/lib/github/tokens";
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
    reviewProfile: "chill",
    autoVerdict: true,
    confidenceThreshold: 0.6,
    customGuidelines: "",
    ignorePatterns: [],
    contextFiles: [],
    maxChunks: 5,
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
      { installationId, fullName: repo.full_name },
      {
        $set: {
          repoGithubId: repo.id,
          removedFromInstallation: false,
          updatedAt: now,
        },
        $setOnInsert: {
          installationRef,
          installationId,
          fullName: repo.full_name,
          enabled: true,
          config: defaultRepoConfig(),
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }
}

async function syncInstallationsForToken(accessToken: string): Promise<{
  installationIds: number[];
  repoCount: number;
}> {
  const installations = await fetchUserInstallations(accessToken);
  let repoCount = 0;
  for (const installation of installations) {
    const { selection, repos } = await fetchInstallationRepos(
      accessToken,
      installation.id,
    );
    const ref = await upsertInstallation(installation, selection);
    await upsertRepos(ref, installation.id, repos);
    repoCount += repos.length;
  }
  return { installationIds: installations.map((i) => i.id), repoCount };
}

export async function connectUser(tokens: GitHubTokenSet): Promise<{
  githubLogin: string;
  installationCount: number;
  repoCount: number;
}> {
  const user = await fetchAuthenticatedUser(tokens.accessToken);
  const { installationIds, repoCount } = await syncInstallationsForToken(
    tokens.accessToken,
  );

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
        installationIds,
        reconnectRequired: false,
        updatedAt: now,
      },
      $setOnInsert: { githubUserId: user.id, createdAt: now },
    },
    { upsert: true },
  );

  return {
    githubLogin: user.login,
    installationCount: installationIds.length,
    repoCount,
  };
}

export async function resyncConnection(connectionId: ObjectId): Promise<{
  installationCount: number;
  repoCount: number;
}> {
  const accessToken = await getValidAccessToken(connectionId);
  const { installationIds, repoCount } =
    await syncInstallationsForToken(accessToken);

  const userConnections = await userConnectionsCollection();
  await userConnections.updateOne(
    { _id: connectionId },
    { $set: { installationIds, updatedAt: new Date() } },
  );

  return { installationCount: installationIds.length, repoCount };
}
