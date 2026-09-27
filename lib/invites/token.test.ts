import { describe, expect, it } from "vitest";
import {
  createInviteToken,
  hashInviteToken,
  inviteState,
  inviteTokenSchema,
  parseInviteState,
} from "@/lib/invites/token";

describe("invite tokens", () => {
  it("creates 43-char base64url tokens that pass the schema", () => {
    const token = createInviteToken();
    expect(token).toHaveLength(43);
    expect(inviteTokenSchema.safeParse(token).success).toBe(true);
    expect(createInviteToken()).not.toBe(token);
  });

  it("hashes deterministically without exposing the token", () => {
    const token = createInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).toMatch(/^[a-f\d]{64}$/);
    expect(hashInviteToken(token)).not.toContain(token);
  });

  it("round-trips a token through the GitHub state param", () => {
    const token = createInviteToken();
    expect(parseInviteState(inviteState(token))).toBe(token);
  });

  it("ignores CSRF states and malformed invite states", () => {
    expect(parseInviteState(null)).toBeNull();
    expect(parseInviteState("a".repeat(64))).toBeNull();
    expect(parseInviteState("inv.short")).toBeNull();
    expect(parseInviteState(`inv.${"a".repeat(42)}/`)).toBeNull();
    expect(parseInviteState(`inv.${"a".repeat(43)}x`)).toBeNull();
  });
});
