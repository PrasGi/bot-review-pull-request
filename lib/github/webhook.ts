import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;

  const expected =
    "sha256=" +
    createHmac("sha256", getEnv().GITHUB_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
