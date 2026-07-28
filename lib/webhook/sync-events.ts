import type { ObjectId } from "mongodb";
import {
  installationsCollection,
  userConnectionsCollection,
  reposCollection,
} from "@/lib/db/collections";
import { defaultRepoConfig } from "@/lib/github/sync";
import type {
  InstallationEvent,
  InstallationRepositoriesEvent,
  WebhookInstallation,
} from "@/lib/webhook/payloads";

async function upsertInstallationFromWebhook(
  installation: WebhookInstallation,
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
        updatedAt: now,
      },
      $setOnInsert: {
        installationId: installation.id,
        repositorySelection: "selected",
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!result) throw new Error("Failed to upsert installation");
  return result._id;
}

async function addRepos(
  installationRef: ObjectId,
  installationId: number,
  repos: { id: number; full_name: string }[],
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

async function linkSenderToInstallation(
  senderId: number | undefined,
  installationId: number,
): Promise<void> {
  if (!senderId) return;
  const connections = await userConnectionsCollection();
  await connections.updateOne(
    { githubUserId: senderId },
    { $addToSet: { installationIds: installationId } },
  );
}

export async function handleInstallationEvent(
  payload: InstallationEvent,
): Promise<void> {
  const installationId = payload.installation.id;

  if (payload.action === "deleted" || payload.action === "suspend") {
    const installations = await installationsCollection();
    const now = new Date();
    const field = payload.action === "deleted" ? "deletedAt" : "suspendedAt";
    await installations.updateOne(
      { installationId },
      { $set: { [field]: now, updatedAt: now } },
    );
    const repos = await reposCollection();
    await repos.updateMany(
      { installationId },
      { $set: { enabled: false, updatedAt: now } },
    );
    return;
  }

  const ref = await upsertInstallationFromWebhook(payload.installation);
  if (payload.repositories?.length) {
    await addRepos(ref, installationId, payload.repositories);
  }
  await linkSenderToInstallation(payload.sender?.id, installationId);
}

export async function handleInstallationRepositoriesEvent(
  payload: InstallationRepositoriesEvent,
): Promise<void> {
  const ref = await upsertInstallationFromWebhook(payload.installation);
  if (payload.repositories_added?.length) {
    await addRepos(ref, payload.installation.id, payload.repositories_added);
  }
  if (payload.repositories_removed?.length) {
    await markReposRemoved(payload.repositories_removed);
  }
  await linkSenderToInstallation(payload.sender?.id, payload.installation.id);
}
