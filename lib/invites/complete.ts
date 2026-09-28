import {
  pendingInstallationsCollection,
  reposCollection,
} from "@/lib/db/collections";
import type { OrgInviteDoc } from "@/lib/db/types";
import { fetchInstallationRepos, fetchUserInstallations } from "@/lib/github/api";
import { exchangeCodeForTokens, revokeUserToken } from "@/lib/github/oauth";
import {
  resyncConnection,
  upsertInstallation,
  upsertRepos,
} from "@/lib/github/sync";
import {
  findInviteByToken,
  findOpenInvitesForAccount,
  markInviteCompleted,
} from "@/lib/invites/invite";
import { inviteStatus } from "@/lib/invites/status";
import { errorFields, log } from "@/lib/logger";

export type InviteCallbackOutcome =
  /** The installation is synced; show the confirmation. */
  | "connected"
  /** A non-owner submitted a request; an owner still has to approve it. */
  | "pending"
  /** Unknown, revoked or expired invite; the invite page explains which. */
  | "invalid"
  | "error";

export interface InviteCallbackInput {
  token: string;
  code: string | null;
  installationId: string | null;
  setupAction: string | null;
}

async function linkReviewer(invite: OrgInviteDoc): Promise<void> {
  try {
    await resyncConnection(invite.reviewerConnectionId);
  } catch (error) {
    // The confirmation page reports "reviewer not linked"; a manual re-sync fixes it.
    log.warn("[invite] reviewer resync failed", {
      inviteId: invite._id.toHexString(),
      ...errorFields(error),
    });
  }
}

async function clearPending(accountLogin: string): Promise<void> {
  if (!accountLogin) return;
  const pending = await pendingInstallationsCollection();
  await pending.deleteOne({ _id: accountLogin });
}

/**
 * Syncs one installation with the owner's short-lived token: proves the owner
 * can see `installationId` (the query param alone is never trusted), then
 * stores the installation and its full repo list, including repos that were
 * selected before this database existed.
 */
async function syncInstallationAsOwner(
  accessToken: string,
  installationId: number,
): Promise<{ accountLogin: string }> {
  const installations = await fetchUserInstallations(accessToken);
  const installation = installations.find((i) => i.id === installationId);
  if (!installation) {
    throw new Error("installation_not_visible_to_owner");
  }

  const { selection, repos } = await fetchInstallationRepos(
    accessToken,
    installationId,
  );
  const ref = await upsertInstallation(installation, selection);
  await upsertRepos(ref, installationId, repos);

  // Repos the owner deselected are no longer covered by the installation.
  const collection = await reposCollection();
  await collection.updateMany(
    {
      installationId,
      fullName: { $nin: repos.map((r) => r.full_name) },
      removedFromInstallation: { $ne: true },
    },
    {
      $set: { removedFromInstallation: true, updatedAt: new Date() },
    },
  );

  return { accountLogin: installation.account?.login ?? "" };
}

export async function completeInviteFromCallback(
  input: InviteCallbackInput,
): Promise<InviteCallbackOutcome> {
  const invite = await findInviteByToken(input.token);
  if (!invite) return "invalid";

  const status = inviteStatus(invite);
  // Reloading the callback after success must not fail.
  if (status === "completed") return "connected";
  if (status !== "open") return "invalid";

  if (input.setupAction === "request") return "pending";

  const installationId = Number(input.installationId);
  if (!input.code || !Number.isSafeInteger(installationId) || installationId <= 0) {
    log.warn("[invite] callback missing code or installation_id", {
      inviteId: invite._id.toHexString(),
      setupAction: input.setupAction,
    });
    return "error";
  }

  let accessToken: string | null = null;
  try {
    accessToken = (await exchangeCodeForTokens(input.code)).accessToken;
    const { accountLogin } = await syncInstallationAsOwner(
      accessToken,
      installationId,
    );
    const marked = await markInviteCompleted(invite._id, {
      installationId,
      accountLogin,
    });
    if (!marked) {
      // Lost a race with the webhook fallback, or the invite was just revoked.
      const latest = await findInviteByToken(input.token);
      return latest?.completedAt ? "connected" : "invalid";
    }
    await clearPending(accountLogin);
    await linkReviewer(invite);
    log.info("[invite] completed", {
      inviteId: invite._id.toHexString(),
      installationId,
      accountLogin,
    });
    return "connected";
  } catch (error) {
    log.error("[invite] callback failed", {
      inviteId: invite._id.toHexString(),
      installationId,
      ...errorFields(error),
    });
    return "error";
  } finally {
    if (accessToken) {
      // The owner's token was only needed for the checks above; never keep it.
      await revokeUserToken(accessToken).catch((error: unknown) => {
        log.warn("[invite] owner token revoke failed", errorFields(error));
      });
    }
  }
}

/**
 * Webhook fallback: GitHub does not always redirect back after an owner edits
 * an existing installation. Completes any open invite for that account and
 * links its reviewer, whose token then syncs the full repo list.
 */
export async function completeOpenInvitesForAccount(
  accountLogin: string,
  installationId: number,
): Promise<number> {
  if (!accountLogin) return 0;
  const invites = await findOpenInvitesForAccount(accountLogin);
  let completed = 0;
  for (const invite of invites) {
    const marked = await markInviteCompleted(invite._id, {
      installationId,
      accountLogin,
    });
    if (!marked) continue;
    completed += 1;
    await linkReviewer(invite);
    log.info("[invite] completed from webhook", {
      inviteId: invite._id.toHexString(),
      installationId,
      accountLogin,
    });
  }
  return completed;
}
