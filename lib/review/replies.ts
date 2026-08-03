import type {
  Finding,
  PreviousFindingStatus,
  RepoConfig,
  Verdict,
  VerdictForcedReason,
} from "@/lib/db/types";
import type { AIProvider } from "@/lib/ai/provider";
import { stripJsonFences } from "@/lib/ai/provider";
import type { ReviewComment } from "@/lib/github/replies";
import {
  buildReplyEvaluationMessages,
  type ReplyEvalFinding,
} from "@/lib/review/prompt";

const REPLY_EVAL_MAX_TOKENS = 1200;
const REPLY_EVAL_TIMEOUT_MS = 90_000;

export interface ReplyBundle {
  findingIndex: number;
  finding: Finding;
  commentId: number;
  replies: ReviewComment[];
}

export function mapFindingsToReplies(params: {
  findings: Finding[];
  botComments: ReviewComment[];
  allComments: ReviewComment[];
  botLogin: string;
  since: Date;
}): ReplyBundle[] {
  const { findings, botComments, allComments, botLogin, since } = params;
  const sinceMs = since.getTime();

  const repliesByParent = new Map<number, ReviewComment[]>();
  for (const c of allComments) {
    if (c.in_reply_to_id === undefined) continue;
    if (c.user.login === botLogin) continue;
    if (new Date(c.created_at).getTime() <= sinceMs) continue;
    const list = repliesByParent.get(c.in_reply_to_id) ?? [];
    list.push(c);
    repliesByParent.set(c.in_reply_to_id, list);
  }

  const bundles: ReplyBundle[] = [];
  for (let i = 0; i < findings.length; i += 1) {
    const finding = findings[i];
    if (!finding) continue;
    const anchor = matchAnchorComment(finding, botComments, i);
    if (!anchor) continue;
    const replies = repliesByParent.get(anchor.id);
    if (!replies || replies.length === 0) continue;
    replies.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    bundles.push({ findingIndex: i, finding, commentId: anchor.id, replies });
  }
  return bundles;
}

function matchAnchorComment(
  finding: Finding,
  botComments: ReviewComment[],
  index: number,
): ReviewComment | undefined {
  const byOrder = botComments[index];
  if (
    byOrder &&
    byOrder.path === finding.path &&
    byOrder.line === finding.line
  ) {
    return byOrder;
  }
  return botComments.find(
    (c) => c.path === finding.path && c.line === finding.line,
  );
}

interface ReplyEvalResult {
  index: number;
  status: PreviousFindingStatus["status"];
  note: string;
}

interface ReplyEvalResponse {
  results: ReplyEvalResult[];
}

const VALID_STATUS = new Set<PreviousFindingStatus["status"]>([
  "resolved",
  "unresolved",
  "not_determinable",
]);

export async function evaluateReplies(params: {
  bundles: ReplyBundle[];
  prTitle: string;
  prIntentExplanation: string;
  provider: AIProvider;
  model: string;
}): Promise<{ statuses: PreviousFindingStatus[]; prompt: string; response: string }> {
  const { bundles, prTitle, prIntentExplanation, provider, model } = params;

  const evalFindings: ReplyEvalFinding[] = bundles.map((b) => ({
    index: b.findingIndex,
    path: b.finding.path,
    line: b.finding.line,
    severity: b.finding.severity,
    blocking: b.finding.blocking,
    findingComment: b.finding.comment,
    replies: b.replies.map((r) => r.body),
  }));

  const messages = buildReplyEvaluationMessages(
    evalFindings,
    prTitle,
    prIntentExplanation,
  );
  const prompt = messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n");

  const completion = await provider.complete({
    model,
    messages,
    maxTokens: REPLY_EVAL_MAX_TOKENS,
    timeoutMs: REPLY_EVAL_TIMEOUT_MS,
  });

  const statuses = parseReplyEval(completion.text, bundles);
  return { statuses, prompt, response: completion.text };
}

function parseReplyEval(
  text: string,
  bundles: ReplyBundle[],
): PreviousFindingStatus[] {
  const known = new Set(bundles.map((b) => b.findingIndex));
  let parsed: ReplyEvalResponse;
  try {
    parsed = JSON.parse(stripJsonFences(text)) as ReplyEvalResponse;
  } catch {
    return bundles.map((b) => ({
      index: b.findingIndex,
      status: "not_determinable",
      note: "Could not evaluate reply (parse error).",
    }));
  }

  const byIndex = new Map<number, PreviousFindingStatus>();
  for (const r of parsed.results ?? []) {
    if (!known.has(r.index)) continue;
    const status = VALID_STATUS.has(r.status) ? r.status : "not_determinable";
    byIndex.set(r.index, {
      index: r.index,
      status,
      note: typeof r.note === "string" ? r.note.slice(0, 200) : "",
    });
  }

  return bundles.map(
    (b) =>
      byIndex.get(b.findingIndex) ?? {
        index: b.findingIndex,
        status: "not_determinable",
        note: "No evaluation returned for this finding.",
      },
  );
}

export interface ReplyVerdict {
  verdict: Verdict;
  forced?: VerdictForcedReason;
  summary: string;
}

export function computeReplyVerdict(params: {
  findings: Finding[];
  statuses: PreviousFindingStatus[];
  config: RepoConfig;
}): ReplyVerdict {
  const { findings, statuses, config } = params;
  const statusByIndex = new Map(statuses.map((s) => [s.index, s.status]));

  const resolvedCount = statuses.filter((s) => s.status === "resolved").length;
  const stillBlocking = findings.some((f, i) => {
    if (!f.blocking) return false;
    return statusByIndex.get(i) !== "resolved";
  });
  const anyPending = statuses.some((s) => s.status === "not_determinable");

  if (!config.autoVerdict) {
    return {
      verdict: "COMMENT",
      forced: "auto_verdict_off",
      summary: summarize(resolvedCount, statuses.length),
    };
  }

  if (stillBlocking) {
    return {
      verdict: "REQUEST_CHANGES",
      forced: "critical_findings",
      summary: `${summarize(resolvedCount, statuses.length)} Unresolved blocking findings remain.`,
    };
  }

  if (anyPending) {
    return {
      verdict: "COMMENT",
      summary: `${summarize(resolvedCount, statuses.length)} Some replies need clarification.`,
    };
  }

  return {
    verdict: "APPROVE",
    summary: `${summarize(resolvedCount, statuses.length)} All raised findings have been addressed.`,
  };
}

function summarize(resolved: number, total: number): string {
  return `Re-reviewed author replies: ${resolved}/${total} finding${total === 1 ? "" : "s"} resolved.`;
}
