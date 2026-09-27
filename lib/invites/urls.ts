import { getEnv } from "@/lib/env";

export function invitePath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

export function connectedPath(token: string, status?: "pending" | "error"): string {
  const base = `${invitePath(token)}/connected`;
  return status ? `${base}?status=${status}` : base;
}

export function inviteUrl(token: string): string {
  return new URL(invitePath(token), getEnv().APP_URL).toString();
}
