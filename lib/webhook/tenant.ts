import {
  accountsCollection,
  reposCollection,
} from "@/lib/db/collections";
import type { AccountDoc, RepoDoc } from "@/lib/db/types";

export type TenantResolution =
  | { ok: true; account: AccountDoc; repo: RepoDoc }
  | { ok: false; reason: string };

export async function resolveTenant(
  installationId: number | undefined,
  repoFullName: string,
): Promise<TenantResolution> {
  if (!installationId) {
    return { ok: false, reason: "missing_installation" };
  }
  const accounts = await accountsCollection();
  const account = await accounts.findOne({ installationId });
  if (!account) {
    return { ok: false, reason: "account_not_found" };
  }
  if (account.reconnectRequired) {
    return { ok: false, reason: "account_reconnect_required" };
  }
  const repos = await reposCollection();
  const repo = await repos.findOne({
    accountId: account._id,
    fullName: repoFullName,
  });
  if (!repo || repo.removedFromInstallation) {
    return { ok: false, reason: "repo_not_registered" };
  }
  if (!repo.enabled) {
    return { ok: false, reason: "repo_disabled" };
  }
  return { ok: true, account, repo };
}
