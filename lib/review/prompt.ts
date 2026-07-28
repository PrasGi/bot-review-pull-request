import type { ReviewProfile } from "@/lib/db/types";
import type { AIMessage } from "@/lib/ai/provider";
import { sanitizeUntrusted } from "@/lib/review/diff-format";
import { PROFILE_KNOBS } from "@/lib/prompts/defaults";

const GUIDELINES_MAX = 2800;
const PR_BODY_MAX = 1000;
const COMMIT_LINES_MAX = 20;

function renderCustomGuidelinesBlock(guidelines: string): string {
  if (!guidelines.trim()) return "";
  const truncated =
    guidelines.length > GUIDELINES_MAX
      ? guidelines.slice(0, GUIDELINES_MAX) + "\n[...truncated]"
      : guidelines;
  return `REPOSITORY-SPECIFIC GUIDELINES (from the repo admin — trusted, take precedence over general preferences above):\n${truncated}`;
}

const BLOCKING_RULE = `
BLOCKING (per finding): set "blocking": true ONLY when you are confident this is a real defect that must be fixed before merge and you can verify it from the diff (clear bug, security hole, data loss, broken contract). If you SUSPECT an issue but cannot fully verify it from the diff alone — complex flow, missing context, "this looks off but I'd need to see X" — set "blocking": false and phrase the comment as "Please double-check that ...". When in doubt, prefer "blocking": false. Never set blocking true for style, nits, or speculation. Almost always set blocking true for: removed auth/permission checks, committed secrets, null deref on a hot path, or a migration that drops data.`;

const FINDING_SHAPE = `{ "path": string, "line": number, "endLine"?: number,
      "severity": "critical"|"major"|"minor"|"nit",
      "category": "bug"|"security"|"performance"|"maintainability"|"test"|"scope",
      "comment": string, "suggestion"?: string, "blocking": boolean }`;

const OUTPUT_SCHEMA_SINGLE = `
OUTPUT JSON SHAPE (return exactly this object, no markdown fences):
{
  "findings": [ ${FINDING_SHAPE} ],
  "chunkSummary": string,
  "summary": string,
  "verdict": "APPROVE"|"REQUEST_CHANGES"|"COMMENT",
  "confidence": number,
  "verdictReason": string,
  "intentMatch": { "status": "match"|"partial"|"mismatch", "explanation": string }
}
${BLOCKING_RULE}`;

const OUTPUT_SCHEMA_CHUNK = `
OUTPUT JSON SHAPE (return exactly this object, no markdown fences):
{
  "findings": [ ${FINDING_SHAPE} ],
  "chunkSummary": string,
  "intentNotes"?: string
}
${BLOCKING_RULE}`;

export function buildSystemPrompt(
  template: string,
  profile: ReviewProfile,
  customGuidelines: string,
  singleChunk: boolean,
): string {
  const knobs = PROFILE_KNOBS[profile];
  const schema = singleChunk ? OUTPUT_SCHEMA_SINGLE : OUTPUT_SCHEMA_CHUNK;
  return (
    template
      .replaceAll("{{maxFindings}}", String(knobs.maxFindings))
      .replaceAll(
        "{{customGuidelinesBlock}}",
        renderCustomGuidelinesBlock(customGuidelines),
      ) + schema
  );
}

export interface UserPromptInput {
  prTitle: string;
  prBody: string | null;
  headBranch: string;
  baseBranch: string;
  prAuthor: string;
  commitMessages: string[];
  chunkIndex: number;
  chunkTotal: number;
  filesInChunk: number;
  filesTotal: number;
  formattedDiff: string;
  previousFindings?: PreviousFindingLine[];
}

export interface PreviousFindingLine {
  path: string;
  line: number;
  severity: string;
  blocking: boolean;
  comment: string;
}

const PREV_FINDINGS_MAX = 20;

function renderPreviousFindings(findings: PreviousFindingLine[]): string {
  const list = findings
    .slice(0, PREV_FINDINGS_MAX)
    .map(
      (f) =>
        `- ${f.path}:${f.line} [${f.severity}${f.blocking ? "/blocking" : ""}] ${f.comment.slice(0, 120)}`,
    )
    .join("\n");
  return [
    "YOUR PREVIOUS FINDINGS on this PR:",
    list,
    "",
    "The diff below is ONLY the code that changed since your last review. Do NOT repeat a previous finding if the change addresses it or the surrounding code is unchanged. Re-raise a previous finding only if the relevant code changed but is still not fixed. Also review the new diff for genuinely new issues.",
    "",
  ].join("\n");
}

export function buildUserPrompt(input: UserPromptInput): string {
  const body = sanitizeUntrusted(input.prBody ?? "").slice(0, PR_BODY_MAX);
  const commits = input.commitMessages
    .slice(0, COMMIT_LINES_MAX)
    .map((m) => `- ${sanitizeUntrusted(m)}`)
    .join("\n");
  const prevBlock =
    input.previousFindings && input.previousFindings.length > 0
      ? renderPreviousFindings(input.previousFindings)
      : "";

  return [
    "<pr_data>",
    `PR TITLE: ${sanitizeUntrusted(input.prTitle)}`,
    `SOURCE → TARGET: ${input.headBranch} → ${input.baseBranch}`,
    `AUTHOR: ${input.prAuthor}`,
    "PR DESCRIPTION:",
    body || "(none)",
    "",
    "COMMIT MESSAGES:",
    commits || "(none)",
    "</pr_data>",
    "",
    `This is chunk ${input.chunkIndex} of ${input.chunkTotal} (${input.filesInChunk} files; ${input.filesTotal} reviewable files in the whole PR).`,
    "",
    prevBlock,
    "<pr_data>",
    input.formattedDiff,
    "</pr_data>",
    "",
    "Review the diff above. Return JSON only, matching the schema described in the system prompt.",
  ].join("\n");
}

export function buildMessages(system: string, user: string): AIMessage[] {
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
