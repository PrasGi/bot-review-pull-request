import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const findOne = vi.fn();
vi.mock("@/lib/db/collections", () => ({
  reviewRequestsCollection: async () => ({ findOne }),
  reposCollection: async () => ({ findOne: async () => ({ fullName: "o/r" }) }),
  reviewsCollection: async () => ({ findOne: async () => null }),
}));

const { GET } = await import("@/app/api/live/[token]/route");

const TOKEN = "c".repeat(43);
const call = (token: string) =>
  GET(new NextRequest(new URL(`/api/live/${token}`, "https://bot-review.example")), {
    params: Promise.resolve({ token }),
  });

describe("GET /api/live/[token]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a malformed token without touching the database", async () => {
    const res = await call("not-a-token");
    expect(res.status).toBe(422);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("is 404 for an unknown token and 410 once expired", async () => {
    findOne.mockResolvedValueOnce(null);
    expect((await call(TOKEN)).status).toBe(404);

    findOne.mockResolvedValueOnce({ finishedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    expect((await call(TOKEN)).status).toBe(410);
  });
});
