import { describe, expect, it } from "vitest";
import { INVITE_TTL_DAYS, inviteExpiry, inviteStatus } from "@/lib/invites/status";

const created = new Date("2026-09-01T00:00:00Z");
const expiresAt = inviteExpiry(created);

describe("inviteStatus", () => {
  it("expires after 7 days", () => {
    expect(INVITE_TTL_DAYS).toBe(7);
    expect(expiresAt.toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });

  it("is open until the expiry instant", () => {
    expect(inviteStatus({ expiresAt }, new Date("2026-09-07T23:59:59Z"))).toBe("open");
    expect(inviteStatus({ expiresAt }, expiresAt)).toBe("expired");
  });

  it("marks revoked invites", () => {
    expect(inviteStatus({ expiresAt, revokedAt: created }, created)).toBe("revoked");
  });

  it("keeps a used invite completed after it would have expired", () => {
    const later = new Date("2026-12-01T00:00:00Z");
    expect(inviteStatus({ expiresAt, completedAt: created }, later)).toBe("completed");
  });
});
