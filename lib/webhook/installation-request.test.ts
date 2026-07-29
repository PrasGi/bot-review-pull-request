import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InstallationRequestEvent } from "@/lib/webhook/payloads";

const updateOne = vi.fn(async () => ({ upsertedCount: 1 }));
const deleteOne = vi.fn(async () => ({ deletedCount: 1 }));

vi.mock("@/lib/db/collections", () => ({
  pendingInstallationsCollection: async () => ({ updateOne, deleteOne }),
  installationsCollection: async () => ({}),
  userConnectionsCollection: async () => ({}),
  reposCollection: async () => ({}),
}));

vi.mock("@/lib/github/sync", () => ({
  defaultRepoConfig: () => ({}),
}));

const { handleInstallationRequestEvent } = await import(
  "@/lib/webhook/sync-events"
);

function event(overrides: Partial<InstallationRequestEvent> = {}): InstallationRequestEvent {
  return {
    action: "created",
    account: { id: 10, login: "acme-org", type: "Organization" },
    requester: { id: 20, login: "member-user" },
    sender: { id: 20, login: "member-user" },
    ...overrides,
  };
}

describe("handleInstallationRequestEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts a pending record on created", async () => {
    await handleInstallationRequestEvent(event());
    expect(updateOne).toHaveBeenCalledTimes(1);
    const call = updateOne.mock.calls[0] as unknown as [
      { _id: string },
      { $set: Record<string, unknown> },
    ];
    expect(call[0]._id).toBe("acme-org");
    expect(call[1].$set.requesterLogin).toBe("member-user");
    expect(call[1].$set.accountType).toBe("Organization");
  });

  it("deletes the pending record on denied", async () => {
    await handleInstallationRequestEvent(event({ action: "denied" }));
    expect(deleteOne).toHaveBeenCalledWith({ _id: "acme-org" });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("deletes the pending record on cancelled", async () => {
    await handleInstallationRequestEvent(event({ action: "cancelled" }));
    expect(deleteOne).toHaveBeenCalledWith({ _id: "acme-org" });
  });

  it("ignores events without an account login", async () => {
    await handleInstallationRequestEvent(event({ account: null }));
    expect(updateOne).not.toHaveBeenCalled();
    expect(deleteOne).not.toHaveBeenCalled();
  });
});
