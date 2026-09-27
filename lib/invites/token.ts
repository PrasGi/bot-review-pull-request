import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/** Prefix on the GitHub `state` param that marks an owner-invite round trip. */
export const INVITE_STATE_PREFIX = "inv.";

// 32 random bytes in base64url is always 43 characters.
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function createInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteState(token: string): string {
  return `${INVITE_STATE_PREFIX}${token}`;
}

/** The invite token carried in a callback `state`, or null when it is not an invite. */
export function parseInviteState(state: string | null): string | null {
  if (!state?.startsWith(INVITE_STATE_PREFIX)) return null;
  const parsed = inviteTokenSchema.safeParse(
    state.slice(INVITE_STATE_PREFIX.length),
  );
  return parsed.success ? parsed.data : null;
}
