import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const updateMany = vi.fn();

vi.mock("@/lib/auth/guard", () => ({
  withGuard: (handler: (r: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("@/lib/db/collections", () => ({
  reposCollection: async () => ({ updateMany }),
}));

const { PATCH } = await import("@/app/api/dashboard/repos/bulk/route");

const ID_A = "a".repeat(24);
const ID_B = "b".repeat(24);

function patch(body: unknown): NextRequest {
  return new NextRequest(new URL("/api/dashboard/repos/bulk", "https://bot-review.example"), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/dashboard/repos/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 1 });
  });

  it("sets only the sent fields on every non-removed repo", async () => {
    const res = await PATCH(
      patch({ ids: [ID_A, ID_B, ID_A], enabled: true, config: { reviewProfile: "expert" } }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ matched: 2, modified: 1 });

    const [filter, update] = updateMany.mock.calls[0] as [
      { _id: { $in: { toHexString(): string }[] }; removedFromInstallation: unknown },
      { $set: Record<string, unknown> },
    ];
    expect(filter._id.$in.map((id) => id.toHexString())).toEqual([ID_A, ID_B]);
    expect(filter.removedFromInstallation).toEqual({ $ne: true });
    expect(update.$set).toMatchObject({ enabled: true, "config.reviewProfile": "expert" });
    expect(Object.keys(update.$set).sort()).toEqual(["config.reviewProfile", "enabled", "updatedAt"]);
  });

  it.each([
    ["no ids", { ids: [], enabled: true }],
    ["a bad id", { ids: ["nope"], enabled: true }],
    ["nothing to change", { ids: [ID_A] }],
    ["provider without model", { ids: [ID_A], config: { provider: "glm" } }],
    ["an unknown profile", { ids: [ID_A], config: { reviewProfile: "harsh" } }],
    ["too many ids", { ids: Array.from({ length: 501 }, () => ID_A), enabled: true }],
  ])("rejects %s", async (_label, body) => {
    const res = await PATCH(patch(body));
    expect(res.status).toBe(422);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
