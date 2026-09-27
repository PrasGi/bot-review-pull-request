import type { ObjectId } from "mongodb";
import { orgInvitesCollection } from "@/lib/db/collections";
import type { OrgInviteDoc } from "@/lib/db/types";
import { ensureInviteIndexes } from "@/lib/invites/indexes";
import { inviteExpiry } from "@/lib/invites/status";
import {
  createInviteToken,
  hashInviteToken,
  inviteTokenSchema,
} from "@/lib/invites/token";

export async function createInvite(input: {
  targetLogin: string;
  reviewerConnectionId: ObjectId;
  now?: Date;
}): Promise<{ token: string; invite: OrgInviteDoc }> {
  await ensureInviteIndexes();
  const invites = await orgInvitesCollection();
  const now = input.now ?? new Date();
  const token = createInviteToken();
  const doc: Omit<OrgInviteDoc, "_id"> = {
    tokenHash: hashInviteToken(token),
    targetLogin: input.targetLogin,
    targetLoginKey: input.targetLogin.toLowerCase(),
    reviewerConnectionId: input.reviewerConnectionId,
    createdAt: now,
    expiresAt: inviteExpiry(now),
  };
  const result = await invites.insertOne(doc as OrgInviteDoc);
  return { token, invite: { ...doc, _id: result.insertedId } };
}

/** Looks an invite up by its raw token; malformed tokens never reach the DB. */
export async function findInviteByToken(
  token: string,
): Promise<OrgInviteDoc | null> {
  if (!inviteTokenSchema.safeParse(token).success) return null;
  const invites = await orgInvitesCollection();
  return invites.findOne({ tokenHash: hashInviteToken(token) });
}

/** Revokes an open invite. Returns false when it is already used, revoked or missing. */
export async function revokeInvite(id: ObjectId): Promise<boolean> {
  const invites = await orgInvitesCollection();
  const result = await invites.updateOne(
    { _id: id, completedAt: { $exists: false }, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  return result.modifiedCount === 1;
}

/**
 * Marks an open, unexpired invite as used. The filter makes it single-use even
 * when the callback and the webhook fallback race each other.
 */
export async function markInviteCompleted(
  id: ObjectId,
  result: { installationId: number; accountLogin: string },
  now: Date = new Date(),
): Promise<boolean> {
  const invites = await orgInvitesCollection();
  const update = await invites.updateOne(
    {
      _id: id,
      completedAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
    },
    { $set: { ...result, completedAt: now } },
  );
  return update.modifiedCount === 1;
}

export async function listRecentInvites(limit = 20): Promise<OrgInviteDoc[]> {
  const invites = await orgInvitesCollection();
  return invites.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function findOpenInvitesForAccount(
  accountLogin: string,
  now: Date = new Date(),
): Promise<OrgInviteDoc[]> {
  const invites = await orgInvitesCollection();
  return invites
    .find({
      targetLoginKey: accountLogin.toLowerCase(),
      completedAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
    })
    .toArray();
}
