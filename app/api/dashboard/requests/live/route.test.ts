import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getLiveReview = vi.fn();
vi.mock("@/lib/auth/guard", () => ({
  withGuard: (handler: (r: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("@/lib/dashboard/live", () => ({ getLiveReview }));

const { GET } = await import("@/app/api/dashboard/requests/live/route");

const get = (query = ""): NextRequest =>
  new NextRequest(new URL(`/api/dashboard/requests/live${query}`, "https://bot-review.example"));

describe("GET /api/dashboard/requests/live", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLiveReview.mockResolvedValue({ focus: null, othersRunning: 0 });
  });

  it("returns the live review without a focus", async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(getLiveReview).toHaveBeenCalledWith(null);
  });

  it("passes a valid focus id through", async () => {
    await GET(get(`?focus=${"a".repeat(24)}`));
    expect((getLiveReview.mock.calls[0]?.[0] as { toHexString(): string }).toHexString()).toBe("a".repeat(24));
  });

  it("rejects a malformed focus id", async () => {
    const res = await GET(get("?focus=$ne"));
    expect(res.status).toBe(422);
    expect(getLiveReview).not.toHaveBeenCalled();
  });
});
