import type { ObjectId } from "mongodb";
import {
  accountsCollection,
  reposCollection,
} from "@/lib/db/collections";
import type { RepoConfig } from "@/lib/db/types";
import { encrypt } from "@/lib/crypto";
import type { GitHubTokenSet } from "@/lib/github/oauth";
import {
  fetchAuthenticatedUser,
  fetchUserInstallations,
  fetchInstallationRepos,
  type GitHubRepo,
} from "@/lib/github/api";

function defaultRepoConfig(): RepoConfig {
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

async function upsertRepos(
  accountId: ObjectId,
  repos: GitHubRepo[],
): Promise<void> {
  const collection = await reposCollection();
  const now = new Date();
  for (const repo of repos) {
    await collection.updateOne(
      { fullName: repo.full_name },
      {
        $set: {
          accountId,
          fullName: repo.full_name,
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

async function resolveInstallationId(
  accessToken: string,
  userId: number,
  hint: number | null,
): Promise<number> {
  if (hint) return hint;
  const installations = await fetchUserInstallations(accessToken);
  const own = installations.find((i) => i.account?.id === userId);
  if (own) return own.id;
  const first = installations[0];
  if (first) return first.id;
  throw new Error("No installation found for this user");
}

export async function connectAccount(
  tokens: GitHubTokenSet,
  installationIdHint: number | null,
): Promise<{
  accountId: ObjectId;
  githubLogin: string;
  repoCount: number;
}> {
  const user = await fetchAuthenticatedUser(tokens.accessToken);
  const installationId = await resolveInstallationId(
    tokens.accessToken,
    user.id,
    installationIdHint,
  );
  const { selection, repos } = await fetchInstallationRepos(
    tokens.accessToken,
    installationId,
  );

  const accounts = await accountsCollection();
  const now = new Date();
  const result = await accounts.findOneAndUpdate(
    { githubUserId: user.id },
    {
      $set: {
        githubLogin: user.login,
        githubUserId: user.id,
        displayName: user.name ?? user.login,
        avatarUrl: user.avatar_url,
        installationId,
        userTokenEncrypted: encrypt(tokens.accessToken),
        tokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        reconnectRequired: false,
        repositorySelection: selection,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) throw new Error("Failed to upsert account");

  await upsertRepos(result._id, repos);

  return {
    accountId: result._id,
    githubLogin: user.login,
    repoCount: repos.length,
  };
}
