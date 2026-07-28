import type { Verdict } from "@/lib/db/types";

const VERDICT_BANNER: Record<Verdict, string> = {
  APPROVE: "Approved ✅",
  REQUEST_CHANGES: "Changes requested 🔴",
  COMMENT: "Comment 💬",
};

export interface SummaryInput {
  verdict: Verdict;
  summary: string;
  caveat?: string;
  newerCommits: boolean;
  shortSha: string;
  model: string;
}

export function buildReviewBody(input: SummaryInput): string {
  const parts: string[] = [
    `**${VERDICT_BANNER[input.verdict]}**`,
    "",
    input.summary,
  ];

  if (input.caveat) {
    parts.push("", `> ⚠️ ${input.caveat}`);
  }

  if (input.newerCommits) {
    parts.push(
      "",
      `> ⚠️ New commits were pushed after \`${input.shortSha}\`. Re-request review to cover them.`,
    );
  }

  parts.push("", `<sub>${input.model}</sub>`);
  return parts.join("\n");
}
