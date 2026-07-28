import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "test-webhook-secret-1234567890";

beforeAll(() => {
  process.env.GITHUB_WEBHOOK_SECRET = SECRET;
  process.env.MONGODB_URI = "mongodb://localhost:1";
  process.env.GITHUB_APP_ID = "1";
  process.env.GITHUB_APP_SLUG = "x";
  process.env.GITHUB_CLIENT_ID = "x";
  process.env.GITHUB_CLIENT_SECRET = "x";
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.SESSION_SECRET = "session-secret-session-secret-32";
});

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/github/webhook");
    const body = JSON.stringify({ action: "review_requested" });
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const { verifyWebhookSignature } = await import("@/lib/github/webhook");
    const body = JSON.stringify({ action: "review_requested" });
    expect(verifyWebhookSignature(body + "x", sign(body))).toBe(false);
  });

  it("rejects a wrong signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/github/webhook");
    expect(verifyWebhookSignature("{}", "sha256=deadbeef")).toBe(false);
  });

  it("rejects a missing signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/github/webhook");
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects an empty signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/github/webhook");
    expect(verifyWebhookSignature("{}", "")).toBe(false);
  });
});
