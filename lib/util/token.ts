import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

// Bearer tokens carried in URLs (invite links, live review links). Only the
// sha256 is stored, so a leaked database never yields a working link.

// 32 random bytes in base64url is always 43 characters.
export const urlTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function createUrlToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashUrlToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
