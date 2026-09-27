import type { AuthorProfileRule, ReviewProfile } from "@/lib/db/types";
import { REVIEW_PROFILES } from "@/lib/prompts/profile-meta";

export type ParsedAuthorRules =
  | { ok: true; rules: AuthorProfileRule[] }
  | { ok: false; error: string };

/** Parses "username = profile" lines. The last rule for a login wins. */
export function parseAuthorRules(text: string): ParsedAuthorRules {
  const byLogin = new Map<string, AuthorProfileRule>();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    const match = /^@?([^\s=]+)\s*=\s*(\S+)$/.exec(line);
    if (!match) {
      return { ok: false, error: `Line ${index + 1}: use "username = profile".` };
    }
    const [, login, profile] = match as unknown as [string, string, string];
    const lower = profile.toLowerCase();
    if (!(REVIEW_PROFILES as string[]).includes(lower)) {
      return {
        ok: false,
        error: `Line ${index + 1}: "${profile}" is not one of ${REVIEW_PROFILES.join(", ")}.`,
      };
    }
    byLogin.set(login.toLowerCase(), { login, profile: lower as ReviewProfile });
  }
  return { ok: true, rules: [...byLogin.values()] };
}
