import type { ObjectId } from "mongodb";
import { accountsCollection } from "@/lib/db/collections";
import type { AccountDoc } from "@/lib/db/types";
import { encrypt, decrypt } from "@/lib/crypto";
import { refreshTokens, type GitHubTokenSet } from "@/lib/github/oauth";

const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;
const LOCK_DURATION_MS = 30 * 1000;
const POLL_INTERVAL_MS = 250;
const POLL_MAX_ATTEMPTS = 20;

function needsRefresh(account: AccountDoc): boolean {
  return account.tokenExpiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS;
}

async function persistTokens(
  accountId: ObjectId,
  tokens: GitHubTokenSet,
): Promise<void> {
  const accounts = await accountsCollection();
  await accounts.updateOne(
    { _id: accountId },
    {
      $set: {
        userTokenEncrypted: encrypt(tokens.accessToken),
        tokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        reconnectRequired: false,
        updatedAt: new Date(),
      },
      $unset: { refreshLockUntil: "" },
    },
  );
}

async function markReconnectRequired(accountId: ObjectId): Promise<void> {
  const accounts = await accountsCollection();
  await accounts.updateOne(
    { _id: accountId },
    { $set: { reconnectRequired: true, updatedAt: new Date() } },
    // Keep refreshLockUntil so it self-expires; do not block reconnect.
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(accountId: ObjectId): Promise<boolean> {
  const accounts = await accountsCollection();
  const now = new Date();
  const result = await accounts.updateOne(
    {
      _id: accountId,
      $or: [
        { refreshLockUntil: { $exists: false } },
        { refreshLockUntil: { $lt: now } },
      ],
    },
    { $set: { refreshLockUntil: new Date(now.getTime() + LOCK_DURATION_MS) } },
  );
  return result.modifiedCount === 1;
}

async function waitForFreshToken(
  accountId: ObjectId,
): Promise<string> {
  const accounts = await accountsCollection();
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const doc = await accounts.findOne({ _id: accountId });
    if (!doc) throw new Error("Account disappeared during token refresh");
    if (doc.reconnectRequired) {
      throw new Error("Account requires reconnect (refresh failed)");
    }
    if (!needsRefresh(doc)) {
      return decrypt(doc.userTokenEncrypted);
    }
  }
  throw new Error("Timed out waiting for concurrent token refresh");
}

// Rotation-safe access-token accessor (plan §2.2 / Oracle C3).
// GitHub invalidates the old refresh token on rotation, so only ONE caller may
// refresh; concurrent callers poll for the winner's result instead of racing.
export async function getValidAccessToken(
  accountId: ObjectId,
): Promise<string> {
  const accounts = await accountsCollection();
  const account = await accounts.findOne({ _id: accountId });
  if (!account) throw new Error("Account not found");
  if (account.reconnectRequired) {
    throw new Error("Account requires reconnect");
  }
  if (!needsRefresh(account)) {
    return decrypt(account.userTokenEncrypted);
  }

  const gotLock = await acquireLock(accountId);
  if (!gotLock) {
    return waitForFreshToken(accountId);
  }

  try {
    const currentRefresh = decrypt(account.refreshTokenEncrypted);
    const fresh = await refreshTokens(currentRefresh);
    await persistTokens(accountId, fresh);
    return fresh.accessToken;
  } catch (error) {
    const reread = await accounts.findOne({ _id: accountId });
    if (reread && !needsRefresh(reread) && !reread.reconnectRequired) {
      return decrypt(reread.userTokenEncrypted);
    }
    await markReconnectRequired(accountId);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Token refresh failed: ${message}`);
  }
}
