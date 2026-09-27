import type { OrgInviteDoc } from "@/lib/db/types";

export const INVITE_TTL_DAYS = 7;

export type InviteStatus = "open" | "expired" | "revoked" | "completed";

export function inviteExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Completed wins over expiry: a used link keeps showing its confirmation. */
export function inviteStatus(
  invite: Pick<OrgInviteDoc, "completedAt" | "revokedAt" | "expiresAt">,
  now: Date = new Date(),
): InviteStatus {
  if (invite.completedAt) return "completed";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "open";
}
