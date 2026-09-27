import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import type { OrgInviteDoc } from "@/lib/db/types";

const findInviteByToken = vi.fn();
const findOpenInvitesForAccount = vi.fn();
const markInviteCompleted = vi.fn();
const exchangeCodeForTokens = vi.fn();
const revokeUserToken = vi.fn();
const fetchUserInstallations = vi.fn();
const fetchInstallationRepos = vi.fn();
const upsertInstallation = vi.fn();
const upsertRepos = vi.fn();
const resyncConnection = vi.fn();
const reposUpdateMany = vi.fn();
const pendingDeleteOne = vi.fn();

vi.mock("@/lib/invites/invite", () => ({
  findInviteByToken,
  findOpenInvitesForAccount,
  markInviteCompleted,
}));
vi.mock("@/lib/github/oauth", () => ({ exchangeCodeForTokens, revokeUserToken }));
vi.mock("@/lib/github/api", () => ({ fetchUserInstallations, fetchInstallationRepos }));
vi.mock("@/lib/github/sync", () => ({ upsertInstallation, upsertRepos, resyncConnection }));
vi.mock("@/lib/db/collections", () => ({
  reposCollection: async () => ({ updateMany: reposUpdateMany }),
  pendingInstallationsCollection: async () => ({ deleteOne: pendingDeleteOne }),
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  errorFields: () => ({}),
}));

const { completeInviteFromCallback, completeOpenInvitesForAccount } = await import(
  "@/lib/invites/complete"
);

const TOKEN = "a".repeat(43);
const ref = new ObjectId();

function openInvite(overrides: Partial<OrgInviteDoc> = {}): OrgInviteDoc {
  const now = new Date();
  return {
    _id: new ObjectId(),
    tokenHash: "hash",
    targetLogin: "YoCoApp",
    targetLoginKey: "yococapp",
    reviewerConnectionId: new ObjectId(),
    createdAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    ...overrides,
  };
}

const input = {
  token: TOKEN,
  code: "the-code",
  installationId: "149732109",
  setupAction: "install",
};

describe("completeInviteFromCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForTokens.mockResolvedValue({ accessToken: "owner-token" });
    revokeUserToken.mockResolvedValue(undefined);
    fetchUserInstallations.mockResolvedValue([
      { id: 149732109, account: { login: "YoCoApp", id: 1, type: "Organization" } },
    ]);
    fetchInstallationRepos.mockResolvedValue({
      selection: "selected",
      repos: [{ id: 1, full_name: "YoCoApp/yoco-lib" }],
    });
    upsertInstallation.mockResolvedValue(ref);
    markInviteCompleted.mockResolvedValue(true);
    resyncConnection.mockResolvedValue({ installationCount: 1, repoCount: 1 });
  });

  it("syncs the installation, completes the invite, links the reviewer and revokes the owner token", async () => {
    const invite = openInvite();
    findInviteByToken.mockResolvedValue(invite);

    await expect(completeInviteFromCallback(input)).resolves.toBe("connected");

    expect(upsertRepos).toHaveBeenCalledWith(ref, 149732109, [{ id: 1, full_name: "YoCoApp/yoco-lib" }]);
    expect(markInviteCompleted).toHaveBeenCalledWith(invite._id, {
      installationId: 149732109,
      accountLogin: "YoCoApp",
    });
    expect(pendingDeleteOne).toHaveBeenCalledWith({ _id: "YoCoApp" });
    expect(resyncConnection).toHaveBeenCalledWith(invite.reviewerConnectionId);
    expect(revokeUserToken).toHaveBeenCalledWith("owner-token");
  });

  it("rejects an installation id the owner cannot see, and still revokes the token", async () => {
    findInviteByToken.mockResolvedValue(openInvite());
    fetchUserInstallations.mockResolvedValue([{ id: 7, account: { login: "other", id: 2 } }]);

    await expect(completeInviteFromCallback(input)).resolves.toBe("error");

    expect(upsertInstallation).not.toHaveBeenCalled();
    expect(markInviteCompleted).not.toHaveBeenCalled();
    expect(revokeUserToken).toHaveBeenCalledWith("owner-token");
  });

  it("returns pending for a non-owner request without exchanging the code", async () => {
    findInviteByToken.mockResolvedValue(openInvite());

    await expect(
      completeInviteFromCallback({ ...input, setupAction: "request", installationId: null }),
    ).resolves.toBe("pending");
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown", null],
    ["revoked", openInvite({ revokedAt: new Date() })],
    ["expired", openInvite({ expiresAt: new Date(0) })],
  ])("treats a %s invite as invalid", async (_label, invite) => {
    findInviteByToken.mockResolvedValue(invite);
    await expect(completeInviteFromCallback(input)).resolves.toBe("invalid");
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("is idempotent once the invite is completed", async () => {
    findInviteByToken.mockResolvedValue(openInvite({ completedAt: new Date() }));
    await expect(completeInviteFromCallback(input)).resolves.toBe("connected");
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("errors on a missing code or a malformed installation id", async () => {
    findInviteByToken.mockResolvedValue(openInvite());
    await expect(completeInviteFromCallback({ ...input, code: null })).resolves.toBe("error");
    await expect(completeInviteFromCallback({ ...input, installationId: "1e3; drop" })).resolves.toBe("error");
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("reports connected when the webhook fallback won the race", async () => {
    const invite = openInvite();
    findInviteByToken
      .mockResolvedValueOnce(invite)
      .mockResolvedValueOnce({ ...invite, completedAt: new Date() });
    markInviteCompleted.mockResolvedValue(false);

    await expect(completeInviteFromCallback(input)).resolves.toBe("connected");
    expect(resyncConnection).not.toHaveBeenCalled();
  });
});

describe("completeOpenInvitesForAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("completes open invites for the account and links each reviewer", async () => {
    const invite = openInvite();
    findOpenInvitesForAccount.mockResolvedValue([invite]);
    markInviteCompleted.mockResolvedValue(true);
    resyncConnection.mockResolvedValue({});

    await expect(completeOpenInvitesForAccount("YoCoApp", 42)).resolves.toBe(1);
    expect(markInviteCompleted).toHaveBeenCalledWith(invite._id, {
      installationId: 42,
      accountLogin: "YoCoApp",
    });
    expect(resyncConnection).toHaveBeenCalledWith(invite.reviewerConnectionId);
  });

  it("does nothing without an account login", async () => {
    await expect(completeOpenInvitesForAccount("", 42)).resolves.toBe(0);
    expect(findOpenInvitesForAccount).not.toHaveBeenCalled();
  });
});
