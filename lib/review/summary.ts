import type { Verdict } from "@/lib/db/types";

const VERDICT_BANNER: Record<Verdict, string> = {
  APPROVE: "Approved ✅",
  REQUEST_CHANGES: "Changes requested 🔴",
  COMMENT: "Comment 💬",
};

export interface PartialReviewInfo {
  totalFiles: number;
  reviewedCount: number;
  skippedFiles: string[];
}

export interface SummaryInput {
  verdict: Verdict;
  summary: string;
  caveat?: string;
  partial?: PartialReviewInfo;
  newerCommits: boolean;
  shortSha: string;
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

  if (input.partial) {
    const { totalFiles, reviewedCount, skippedFiles } = input.partial;
    const shown = skippedFiles.slice(0, 10);
    const more =
      skippedFiles.length > shown.length
        ? ` (+${skippedFiles.length - shown.length} more)`
        : "";
    parts.push(
      "",
      `> ⚠️ **Partial review**: this PR is large (${totalFiles} files). I reviewed the ${reviewedCount} highest-priority files within the time budget. Not reviewed: ${shown.map((f) => `\`${f}\``).join(", ")}${more}. Split the PR or re-request for full coverage.`,
    );
  }

  if (input.newerCommits) {
    parts.push(
      "",
      `> ⚠️ New commits were pushed after \`${input.shortSha}\`. Re-request review to cover them.`,
    );
  }

  return parts.join("\n");
}
