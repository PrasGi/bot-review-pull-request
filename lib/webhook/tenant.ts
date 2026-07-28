import {
  installationsCollection,
  reposCollection,
  userConnectionsCollection,
} from "@/lib/db/collections";
import type {
  InstallationDoc,
  RepoDoc,
  UserConnectionDoc,
} from "@/lib/db/types";

export type TenantResolution =
  | {
      ok: true;
      installation: InstallationDoc;
      repo: RepoDoc;
      reviewer: UserConnectionDoc;
    }
  | { ok: false; reason: string };

export type RepoResolution =
  | { ok: true; installation: InstallationDoc; repo: RepoDoc }
  | { ok: false; reason: string };

export async function resolveRepo(
  installationId: number | undefined,
  repoFullName: string,
): Promise<RepoResolution> {
  if (!installationId) return { ok: false, reason: "missing_installation" };

  const installations = await installationsCollection();
  const installation = await installations.findOne({ installationId });
  if (!installation) return { ok: false, reason: "installation_not_found" };
  if (installation.suspendedAt || installation.deletedAt) {
    return { ok: false, reason: "installation_inactive" };
  }

  const repos = await reposCollection();
  const repo = await repos.findOne({ installationId, fullName: repoFullName });
  if (!repo || repo.removedFromInstallation) {
    return { ok: false, reason: "repo_not_covered" };
  }
  if (!repo.enabled) return { ok: false, reason: "repo_disabled" };

  return { ok: true, installation, repo };
}

export async function resolveReviewTenant(
  installationId: number | undefined,
  repoFullName: string,
  reviewerId: number | undefined,
): Promise<TenantResolution> {
  if (!reviewerId) return { ok: false, reason: "missing_reviewer" };

  const repoResult = await resolveRepo(installationId, repoFullName);
  if (!repoResult.ok) return repoResult;

  const connections = await userConnectionsCollection();
  const reviewer = await connections.findOne({ githubUserId: reviewerId });
  if (!reviewer) return { ok: false, reason: "reviewer_not_connected" };
  if (reviewer.reconnectRequired) {
    return { ok: false, reason: "reviewer_reconnect_required" };
  }
  if (!reviewer.installationIds.includes(installationId as number)) {
    return { ok: false, reason: "reviewer_not_linked_to_installation" };
  }

  return {
    ok: true,
    installation: repoResult.installation,
    repo: repoResult.repo,
    reviewer,
  };
}
