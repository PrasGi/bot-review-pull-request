import { createUrlToken, hashUrlToken, urlTokenSchema } from "@/lib/util/token";

/** Prefix on the GitHub `state` param that marks an owner-invite round trip. */
export const INVITE_STATE_PREFIX = "inv.";

export const inviteTokenSchema = urlTokenSchema;
export const createInviteToken = createUrlToken;
export const hashInviteToken = hashUrlToken;

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
