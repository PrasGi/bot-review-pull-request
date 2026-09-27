import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const completeInviteFromCallback = vi.fn();
const exchangeCodeForTokens = vi.fn();

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ APP_URL: "https://bot-review.example", NODE_ENV: "test" }),
  requireGithubEnv: () => undefined,
}));
vi.mock("@/lib/invites/complete", () => ({ completeInviteFromCallback }));
vi.mock("@/lib/github/oauth", () => ({ exchangeCodeForTokens, buildInstallUrl: vi.fn() }));
vi.mock("@/lib/github/sync", () => ({ connectUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ SESSION_COOKIE: "pr_session" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, delete: () => undefined }),
}));

const { GET } = await import("@/app/api/github/callback/route");

const TOKEN = "b".repeat(43);

function callback(query: string): NextRequest {
  return new NextRequest(new URL(`/api/github/callback?${query}`, "https://bot-review.example"));
}

describe("GET /api/github/callback (owner invite)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["connected", `/invite/${TOKEN}/connected`],
    ["pending", `/invite/${TOKEN}/connected?status=pending`],
    ["error", `/invite/${TOKEN}/connected?status=error`],
    ["invalid", `/invite/${TOKEN}`],
  ])("redirects a %s outcome", async (outcome, path) => {
    completeInviteFromCallback.mockResolvedValue(outcome);
    const res = await GET(
      callback(`code=c&state=inv.${TOKEN}&installation_id=149732109&setup_action=install`),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`https://bot-review.example${path}`);
    expect(completeInviteFromCallback).toHaveBeenCalledWith({
      token: TOKEN,
      code: "c",
      installationId: "149732109",
      setupAction: "install",
    });
    // The owner's code is never exchanged by the regular connect path.
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("leaves non-invite states to the regular connect path", async () => {
    const res = await GET(callback(`code=c&state=${"f".repeat(64)}`));
    expect(completeInviteFromCallback).not.toHaveBeenCalled();
    // No CSRF cookie: the pre-existing "received" page.
    expect(res.headers.get("location")).toBe("https://bot-review.example/connected?status=received");
  });
});
