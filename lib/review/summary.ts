import type { Verdict } from "@/lib/db/types";

const VERDICT_BANNER: Record<Verdict, string> = {
  APPROVE: "Approved ✅",
  REQUEST_CHANGES: "Changes requested 🔴",
  COMMENT: "Comment 💬",
};

const GENERIC_FALLBACK: Record<Verdict, string> = {
  APPROVE: "All good — no blocking issues found.",
  REQUEST_CHANGES: "See comments.",
  COMMENT: "See comments.",
};

export interface SummaryComposition {
  verdict: Verdict;
  summary?: string | undefined;
  verdictReason?: string | undefined;
  chunkSummaries?: string[] | undefined;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function restates(overview: string, reason: string): boolean {
  const a = normalize(overview);
  const b = normalize(reason);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export function composeSummary(input: SummaryComposition): string {
  const chunkSummaries = (input.chunkSummaries ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const overview =
    input.summary?.trim() ||
    (chunkSummaries.length === 1
      ? (chunkSummaries[0] ?? "")
      : chunkSummaries.map((s) => `- ${s}`).join("\n"));

  const reason = input.verdictReason?.trim() ?? "";

  const parts: string[] = [];
  if (overview) parts.push(overview);
  if (reason && !restates(overview, reason)) parts.push(reason);

  return parts.length > 0 ? parts.join("\n\n") : GENERIC_FALLBACK[input.verdict];
}

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
