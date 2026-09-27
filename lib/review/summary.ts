import type { FindingSeverity, Verdict } from "@/lib/db/types";

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

export type IncompleteReason = "token_budget" | "time_budget" | "chunk_failed";

const INCOMPLETE_NOTE: Record<IncompleteReason, string> = {
  token_budget:
    "**Token limit reached** — this PR is bigger than one review pass can hold, so part of it was never read.",
  time_budget:
    "**Time limit reached** — the review hit its 30-minute ceiling before every file was read.",
  chunk_failed:
    "**Incomplete read** — part of the diff failed to come back from the model, so it was never reviewed.",
};

export interface PartialReviewInfo {
  totalFiles: number;
  reviewedCount: number;
  skippedFiles: string[];
}

// Non-blocking findings (nits, style, "please double-check" items) get folded
// into one collapsible section instead of their own inline thread — the
// individual-comment treatment is reserved for findings that actually need
// changes. This also means they lose per-finding resolved/unresolved tracking
// on re-review (there's no inline comment to anchor a reply to), which is an
// acceptable trade for not burying the PR in single-line comments.
export interface NonBlockingFinding {
  path: string;
  line: number;
  severity: FindingSeverity;
  comment: string;
  suggestion?: string;
}

function renderNonBlockingSection(findings: NonBlockingFinding[]): string[] {
  if (findings.length === 0) return [];
  const items = findings.map((f) => {
    const suggestion = f.suggestion
      ? `\n\n  \`\`\`\n  ${f.suggestion}\n  \`\`\``
      : "";
    return `- \`${f.path}:${f.line}\` **${f.severity}** — ${f.comment}${suggestion}`;
  });
  return [
    "",
    "<details>",
    `<summary>Other notes (${findings.length})</summary>`,
    "",
    items.join("\n"),
    "",
    "</details>",
  ];
}

export interface SummaryInput {
  verdict: Verdict;
  summary: string;
  caveat?: string;
  partial?: PartialReviewInfo;
  incomplete?: IncompleteReason | undefined;
  nonBlockingFindings?: NonBlockingFinding[];
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

  if (input.incomplete) {
    const covered = input.partial
      ? ` I read ${input.partial.reviewedCount} of ${input.partial.totalFiles} files.`
      : "";
    parts.push(
      "",
      `> ⚠️ ${INCOMPLETE_NOTE[input.incomplete]}${covered} Because the read is incomplete this is a **comment only** — not an approval and not a change request. Split the PR or re-request to get full coverage.`,
    );
  }

  if (input.partial) {
    const { skippedFiles } = input.partial;
    const shown = skippedFiles.slice(0, 10);
    const more =
      skippedFiles.length > shown.length
        ? ` (+${skippedFiles.length - shown.length} more)`
        : "";
    parts.push(
      "",
      `> Not reviewed: ${shown.map((f) => `\`${f}\``).join(", ")}${more}.`,
    );
  }

  if (input.newerCommits) {
    parts.push(
      "",
      `> ⚠️ New commits were pushed after \`${input.shortSha}\`. Re-request review to cover them.`,
    );
  }

  parts.push(...renderNonBlockingSection(input.nonBlockingFindings ?? []));

  return parts.join("\n");
}

/**
 * Posted on the PR when a review and its automatic retry both failed. It carries no
 * error details: stored messages are raw provider output and may contain secrets.
 */
export function buildFailureComment(headSha: string): string {
  return [
    "> ⚠️ **Automated review could not be completed.**",
    `> The review system hit an internal error while reviewing \`${headSha.slice(0, 7)}\`, and an automatic retry failed as well, so no review was posted.`,
    "> This is not a problem with the code in this PR. Re-request review to try again.",
  ].join("\n");
}
