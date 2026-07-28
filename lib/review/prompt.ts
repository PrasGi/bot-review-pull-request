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

const OUTPUT_SCHEMA_SINGLE = `
OUTPUT JSON SHAPE (return exactly this object, no markdown fences):
{
  "findings": [
    { "path": string, "line": number, "endLine"?: number,
      "severity": "critical"|"major"|"minor"|"nit",
      "category": "bug"|"security"|"performance"|"maintainability"|"test"|"scope",
      "comment": string, "suggestion"?: string }
  ],
  "chunkSummary": string,
  "summary": string,
  "verdict": "APPROVE"|"REQUEST_CHANGES"|"COMMENT",
  "confidence": number,
  "verdictReason": string,
  "intentMatch": { "status": "match"|"partial"|"mismatch", "explanation": string }
}`;

const OUTPUT_SCHEMA_CHUNK = `
OUTPUT JSON SHAPE (return exactly this object, no markdown fences):
{
  "findings": [
    { "path": string, "line": number, "endLine"?: number,
      "severity": "critical"|"major"|"minor"|"nit",
      "category": "bug"|"security"|"performance"|"maintainability"|"test"|"scope",
      "comment": string, "suggestion"?: string }
  ],
  "chunkSummary": string,
  "intentNotes"?: string
}`;

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
}

export function buildUserPrompt(input: UserPromptInput): string {
  const body = sanitizeUntrusted(input.prBody ?? "").slice(0, PR_BODY_MAX);
  const commits = input.commitMessages
    .slice(0, COMMIT_LINES_MAX)
    .map((m) => `- ${sanitizeUntrusted(m)}`)
    .join("\n");

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
