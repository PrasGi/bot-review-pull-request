import type { ObjectId } from "mongodb";
import {
  accountsCollection,
  reposCollection,
} from "@/lib/db/collections";
import { defaultRepoConfig } from "@/lib/github/sync";
import type {
  InstallationEvent,
  InstallationRepositoriesEvent,
} from "@/lib/webhook/payloads";

async function ensureAccountPlaceholder(
  installationId: number,
  account: { id: number; login: string } | null | undefined,
): Promise<ObjectId> {
  const accounts = await accountsCollection();
  const now = new Date();
  const result = await accounts.findOneAndUpdate(
    { installationId },
    {
      $set: { updatedAt: now },
      $setOnInsert: {
        installationId,
        githubUserId: account?.id ?? 0,
        githubLogin: account?.login ?? "",
        displayName: account?.login ?? "",
        userTokenEncrypted: "",
        tokenExpiresAt: now,
        refreshTokenEncrypted: "",
        refreshTokenExpiresAt: now,
        reconnectRequired: true,
        repositorySelection: "selected",
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!result) throw new Error("Failed to upsert account placeholder");
  return result._id;
}

async function addRepos(
  accountId: ObjectId,
  repos: { full_name: string }[],
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

async function markReposRemoved(
  repos: { full_name: string }[],
): Promise<void> {
  const collection = await reposCollection();
  const now = new Date();
  for (const repo of repos) {
    await collection.updateOne(
      { fullName: repo.full_name },
      { $set: { removedFromInstallation: true, enabled: false, updatedAt: now } },
    );
  }
}

export async function handleInstallationEvent(
  payload: InstallationEvent,
): Promise<void> {
  const installationId = payload.installation.id;

  if (payload.action === "deleted" || payload.action === "suspend") {
    const accounts = await accountsCollection();
    const account = await accounts.findOne({ installationId });
    if (account) {
      await accounts.updateOne(
        { _id: account._id },
        { $set: { reconnectRequired: true, updatedAt: new Date() } },
      );
      const repos = await reposCollection();
      await repos.updateMany(
        { accountId: account._id },
        { $set: { enabled: false, updatedAt: new Date() } },
      );
    }
    return;
  }

  const accountId = await ensureAccountPlaceholder(
    installationId,
    payload.installation.account,
  );
  if (payload.repositories && payload.repositories.length > 0) {
    await addRepos(accountId, payload.repositories);
  }
}

export async function handleInstallationRepositoriesEvent(
  payload: InstallationRepositoriesEvent,
): Promise<void> {
  const accountId = await ensureAccountPlaceholder(
    payload.installation.id,
    payload.installation.account,
  );
  if (payload.repositories_added?.length) {
    await addRepos(accountId, payload.repositories_added);
  }
  if (payload.repositories_removed?.length) {
    await markReposRemoved(payload.repositories_removed);
  }
}
