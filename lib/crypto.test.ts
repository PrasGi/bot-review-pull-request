import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
  process.env.MONGODB_URI = "mongodb://localhost:1";
  process.env.GITHUB_APP_ID = "1";
  process.env.GITHUB_APP_SLUG = "x";
  process.env.GITHUB_CLIENT_ID = "x";
  process.env.GITHUB_CLIENT_SECRET = "x";
  process.env.GITHUB_WEBHOOK_SECRET = "x";
  process.env.SESSION_SECRET = "session-secret-session-secret-32";
});

describe("crypto", () => {
  it("round-trips plaintext through encrypt/decrypt", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const secret = "ghu_someUserAccessToken_12345";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces different ciphertext for the same input (random IV)", async () => {
    const { encrypt } = await import("@/lib/crypto");
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered ciphertext (auth tag)", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const encoded = encrypt("secret");
    const bytes = Buffer.from(encoded, "base64");
    bytes[bytes.length - 1] ^= 0xff;
    expect(() => decrypt(bytes.toString("base64"))).toThrow();
  });

  it("safeEqual is true for equal strings and false otherwise", async () => {
    const { safeEqual } = await import("@/lib/crypto");
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
