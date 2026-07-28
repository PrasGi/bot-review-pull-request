import { randomBytes, createHash } from "node:crypto";
import { verify } from "@node-rs/argon2";
import {
  sessionsCollection,
  settingsCollection,
} from "@/lib/db/collections";

export const SESSION_COOKIE = "pr_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function verifyAdminCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const settings = await (await settingsCollection()).findOne({ _id: "global" });
  if (!settings) return false;
  if (settings.adminEmail.toLowerCase() !== email.toLowerCase()) return false;
  try {
    return await verify(settings.adminPasswordHash, password);
  } catch {
    return false;
  }
}

export async function createSession(meta: {
  ip?: string;
  userAgent?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const sessions = await sessionsCollection();
  await sessions.insertOne({
    _id: hashToken(token),
    createdAt: now,
    expiresAt,
    ...(meta.ip ? { ip: meta.ip } : {}),
    ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
  });
  return { token, expiresAt };
}

export async function validateSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const sessions = await sessionsCollection();
  const doc = await sessions.findOne({ _id: hashToken(token) });
  if (!doc) return false;
  return doc.expiresAt.getTime() > Date.now();
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  const sessions = await sessionsCollection();
  await sessions.deleteOne({ _id: hashToken(token) });
}
