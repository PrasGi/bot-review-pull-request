import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InstallationEvent, InstallationRepositoriesEvent } from "@/lib/webhook/payloads";

const installationUpdateOne = vi.fn(async () => ({}));
const installationFindOneAndUpdate = vi.fn(async () => ({ _id: "ref" }));
const repoUpdateOne = vi.fn(async () => ({}));
const repoUpdateMany = vi.fn(async () => ({}));

vi.mock("@/lib/db/collections", () => ({
  installationsCollection: async () => ({
    updateOne: installationUpdateOne,
    findOneAndUpdate: installationFindOneAndUpdate,
  }),
  reposCollection: async () => ({ updateOne: repoUpdateOne, updateMany: repoUpdateMany }),
  userConnectionsCollection: async () => ({ updateOne: vi.fn(async () => ({})) }),
  pendingInstallationsCollection: async () => ({ deleteOne: vi.fn(async () => ({})) }),
}));
vi.mock("@/lib/github/sync", () => ({ defaultRepoConfig: () => ({ reviewProfile: "chill" }) }));

const { handleInstallationEvent, handleInstallationRepositoriesEvent } = await import(
  "@/lib/webhook/sync-events"
);

const installation = { id: 42, account: { id: 1, login: "acme", type: "Organization" as const } };

function setOf(mock: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  return ((mock.mock.calls[call] as unknown[])[1] as { $set: Record<string, unknown> }).$set;
}

describe("installation lifecycle keeps each repo's review switch", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["deleted", "suspend"])("flags the installation on %s without disabling its repos", async (action) => {
    await handleInstallationEvent({ action, installation } as InstallationEvent);
    const field = action === "deleted" ? "deletedAt" : "suspendedAt";
    expect(setOf(installationUpdateOne)).toHaveProperty(field);
    expect(repoUpdateMany).not.toHaveBeenCalled();
    expect(repoUpdateOne).not.toHaveBeenCalled();
  });

  it("clears the suspension on unsuspend and reinstall", async () => {
    await handleInstallationEvent({ action: "unsuspend", installation } as InstallationEvent);
    const update = (installationFindOneAndUpdate.mock.calls[0] as unknown[])[1] as { $unset: Record<string, string> };
    expect(update.$unset).toEqual({ suspendedAt: "", deletedAt: "" });
  });

  it("marks removed repos without touching enabled, and re-adding only clears the flag", async () => {
    await handleInstallationRepositoriesEvent({
      action: "removed",
      installation,
      repository_selection: "selected",
      repositories_removed: [{ id: 7, full_name: "acme/api" }],
    } as InstallationRepositoriesEvent);
    expect(setOf(repoUpdateOne)).toEqual({ removedFromInstallation: true, updatedAt: expect.any(Date) });

    vi.clearAllMocks();
    await handleInstallationRepositoriesEvent({
      action: "added",
      installation,
      repository_selection: "selected",
      repositories_added: [{ id: 7, full_name: "acme/api" }],
    } as InstallationRepositoriesEvent);
    const update = (repoUpdateOne.mock.calls[0] as unknown[])[1] as {
      $set: Record<string, unknown>;
      $setOnInsert: Record<string, unknown>;
    };
    expect(update.$set).toMatchObject({ removedFromInstallation: false });
    expect(update.$set).not.toHaveProperty("enabled");
    // New repos start enabled; existing ones keep whatever the admin chose.
    expect(update.$setOnInsert).toMatchObject({ enabled: true });
  });
});
