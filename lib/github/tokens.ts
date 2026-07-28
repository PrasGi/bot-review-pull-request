import type { ObjectId } from "mongodb";
import { userConnectionsCollection } from "@/lib/db/collections";
import type { UserConnectionDoc } from "@/lib/db/types";
import { encrypt, decrypt } from "@/lib/crypto";
import { refreshTokens, type GitHubTokenSet } from "@/lib/github/oauth";

const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;
const LOCK_DURATION_MS = 30 * 1000;
const POLL_INTERVAL_MS = 250;
const POLL_MAX_ATTEMPTS = 20;

function needsRefresh(account: UserConnectionDoc): boolean {
  return account.tokenExpiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS;
}

async function persistTokens(
  connectionId: ObjectId,
  tokens: GitHubTokenSet,
): Promise<void> {
  const connections = await userConnectionsCollection();
  await connections.updateOne(
    { _id: connectionId },
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

async function markReconnectRequired(connectionId: ObjectId): Promise<void> {
  const connections = await userConnectionsCollection();
  await connections.updateOne(
    { _id: connectionId },
    { $set: { reconnectRequired: true, updatedAt: new Date() } },
    // Keep refreshLockUntil so it self-expires; do not block reconnect.
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(connectionId: ObjectId): Promise<boolean> {
  const connections = await userConnectionsCollection();
  const now = new Date();
  const result = await connections.updateOne(
    {
      _id: connectionId,
      $or: [
        { refreshLockUntil: { $exists: false } },
        { refreshLockUntil: { $lt: now } },
      ],
    },
    { $set: { refreshLockUntil: new Date(now.getTime() + LOCK_DURATION_MS) } },
  );
  return result.modifiedCount === 1;
}

async function waitForFreshToken(connectionId: ObjectId): Promise<string> {
  const connections = await userConnectionsCollection();
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const doc = await connections.findOne({ _id: connectionId });
    if (!doc) throw new Error("User connection disappeared during refresh");
    if (doc.reconnectRequired) {
      throw new Error("User connection requires reconnect (refresh failed)");
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
  connectionId: ObjectId,
): Promise<string> {
  const connections = await userConnectionsCollection();
  const connection = await connections.findOne({ _id: connectionId });
  if (!connection) throw new Error("User connection not found");
  if (connection.reconnectRequired) {
    throw new Error("User connection requires reconnect");
  }
  if (!needsRefresh(connection)) {
    return decrypt(connection.userTokenEncrypted);
  }

  const gotLock = await acquireLock(connectionId);
  if (!gotLock) {
    return waitForFreshToken(connectionId);
  }

  try {
    const currentRefresh = decrypt(connection.refreshTokenEncrypted);
    const fresh = await refreshTokens(currentRefresh);
    await persistTokens(connectionId, fresh);
    return fresh.accessToken;
  } catch (error) {
    const reread = await connections.findOne({ _id: connectionId });
    if (reread && !needsRefresh(reread) && !reread.reconnectRequired) {
      return decrypt(reread.userTokenEncrypted);
    }
    await markReconnectRequired(connectionId);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Token refresh failed: ${message}`);
  }
}
