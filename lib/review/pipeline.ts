import { ObjectId } from "mongodb";
import {
  reposCollection,
  userConnectionsCollection,
  settingsCollection,
  reviewsCollection,
} from "@/lib/db/collections";
import type {
  Finding,
  IntentMatch,
  ReviewRequestDoc,
  Verdict,
} from "@/lib/db/types";
import { getValidAccessToken } from "@/lib/github/tokens";
import {
  fetchPullRequest,
  fetchPullRequestFiles,
  submitReview,
  type InlineComment,
} from "@/lib/github/pr";
import { formatFilesForPrompt } from "@/lib/review/diff-format";
import { filterFiles } from "@/lib/review/filter";
import { chunkFiles } from "@/lib/review/chunk";
import { resolveModel } from "@/lib/ai/factory";
import { computeCostUsd } from "@/lib/ai/provider";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildMessages,
} from "@/lib/review/prompt";
import { chunkReviewSchema } from "@/lib/review/schemas";
import type { FindingOutput, IntentMatchOutput } from "@/lib/review/schemas";
import {
  enforceKnobs,
  filterFindingsToValidLines,
  resolveVerdict,
} from "@/lib/review/verdict";
import { buildReviewBody } from "@/lib/review/summary";
import { recordAiCall } from "@/lib/review/audit";
import { TEMPLATE_VERSION } from "@/lib/prompts/defaults";

const OUTPUT_HEADROOM = 4096;
const MAX_TOKENS_CHUNK = 4096;
const DEFAULT_CONTEXT = 128_000;

function splitRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/");
  return { owner: owner ?? "", repo: repo ?? "" };
}

function parseChunkOutput(raw: string): {
  findings: FindingOutput[];
  summary?: string;
  verdict?: Verdict;
  confidence?: number;
  intentMatch?: IntentMatchOutput;
} {
  const json: unknown = JSON.parse(raw);
  const parsed = chunkReviewSchema.parse(json);
  return {
    findings: parsed.findings,
    summary: parsed.summary,
    verdict: parsed.verdict,
    confidence: parsed.confidence,
    intentMatch: parsed.intentMatch,
  };
}

export interface PipelineResult {
  verdict: Verdict;
  reviewId: ObjectId;
  findingsCount: number;
}

export async function runReviewPipeline(
  request: ReviewRequestDoc,
  heartbeat: () => Promise<void>,
): Promise<PipelineResult> {
  const repos = await reposCollection();
  const repo = await repos.findOne({ _id: request.repoId });
  if (!repo) throw new Error("repo not found");

  const connections = await userConnectionsCollection();
  const reviewer = await connections.findOne({
    _id: request.userConnectionId,
  });
  if (!reviewer) throw new Error("reviewer connection not found");

  const settings = await (await settingsCollection()).findOne({ _id: "global" });
  if (!settings) throw new Error("settings not found");

  const token = await getValidAccessToken(reviewer._id);
  const { owner, repo: repoName } = splitRepo(repo.fullName);

  const pr = await fetchPullRequest(token, owner, repoName, request.prNumber);
  await heartbeat();
  const allFiles = await fetchPullRequestFiles(
    token,
    owner,
    repoName,
    request.prNumber,
  );

  const { kept } = filterFiles(allFiles, repo.config.ignorePatterns);

  const { provider, model, instance } = resolveModel(repo.config, settings);
  const pricing = settings.modelPricing.find(
    (p) => p.provider === provider && p.model === model,
  );

  if (kept.length === 0) {
    const body = buildReviewBody({
      verdict: "COMMENT",
      summary: "No reviewable code changes (only lockfiles/generated files).",
      intentMatch: { status: "match", explanation: "" },
      newerCommits: request.newerCommitsFlag ?? false,
      shortSha: pr.headSha.slice(0, 7),
      model,
    });
    const result = await submitReview(token, {
      owner,
      repo: repoName,
      prNumber: request.prNumber,
      commitId: pr.headSha,
      event: "COMMENT",
      body,
      comments: [],
    });
    return persistReview({
      request,
      repoId: repo._id,
      verdict: "COMMENT",
      summary: "Nothing reviewable.",
      intentMatch: { status: "match", explanation: "No reviewable code." },
      findings: [],
      headSha: pr.headSha,
      githubReviewId: result.githubReviewId,
    });
  }

  const diffBudget = DEFAULT_CONTEXT - OUTPUT_HEADROOM - 2000;
  const { chunks } = chunkFiles(
    kept,
    diffBudget,
    repo.config.maxChunks,
  );

  const systemPrompt = buildSystemPrompt(
    settings.promptTemplates[repo.config.reviewProfile].system,
    repo.config.reviewProfile,
    repo.config.customGuidelines,
    chunks.length === 1,
  );

  const allFindings: FindingOutput[] = [];
  let proposedVerdict: Verdict = "COMMENT";
  let confidence = 0.5;
  let intentMatch: IntentMatchOutput = {
    status: "match",
    explanation: "",
  };
  let summaryText = "";

  const newHunkLinesByPath = new Map<string, Set<number>>();

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    if (!chunk) continue;
    const formatted = formatFilesForPrompt(chunk.files);
    for (const [path, lines] of formatted.newHunkLinesByPath) {
      newHunkLinesByPath.set(path, lines);
    }

    const userPrompt = buildUserPrompt({
      prTitle: pr.title,
      prBody: pr.body,
      headBranch: "head",
      baseBranch: "base",
      prAuthor: pr.authorLogin,
      commitMessages: pr.commitMessages,
      chunkIndex: i + 1,
      chunkTotal: chunks.length,
      filesInChunk: chunk.files.length,
      filesTotal: kept.length,
      formattedDiff: formatted.rendered,
    });
    const messages = buildMessages(systemPrompt, userPrompt);

    const started = Date.now();
    const completion = await instance.complete({
      model,
      messages,
      maxTokens: MAX_TOKENS_CHUNK,
    });
    const latencyMs = Date.now() - started;
    const cost = computeCostUsd(completion.usage, pricing);

    let output: ReturnType<typeof parseChunkOutput> | null = null;
    let parseError: string | undefined;
    try {
      output = parseChunkOutput(completion.text);
    } catch (error) {
      parseError = error instanceof Error ? error.message : "parse error";
    }

    await recordAiCall({
      requestId: request._id,
      repoId: repo._id,
      userConnectionId: reviewer._id,
      provider,
      model,
      purpose: "chunk-review",
      templateVersion: TEMPLATE_VERSION,
      prompt: `${systemPrompt}\n\n---\n\n${userPrompt}`,
      response: completion.text,
      usage: completion.usage,
      costUsd: cost,
      latencyMs,
      status: output ? "ok" : "error",
      errorMessage: parseError,
    });

    if (!output) throw new Error(`chunk ${i + 1} JSON parse failed: ${parseError}`);

    allFindings.push(...output.findings);
    if (output.verdict) proposedVerdict = output.verdict;
    if (output.confidence !== undefined) confidence = output.confidence;
    if (output.intentMatch) intentMatch = output.intentMatch;
    if (output.summary) summaryText = output.summary;

    await heartbeat();
  }

  const lineFiltered = filterFindingsToValidLines(
    allFindings,
    newHunkLinesByPath,
  );
  const knobFiltered = enforceKnobs(lineFiltered.kept, repo.config.reviewProfile);
  const findingsOut: Finding[] = knobFiltered.kept.map((f) => ({
    ...f,
    posted: true,
  }));

  const resolution = resolveVerdict({
    proposed: proposedVerdict,
    confidence,
    intentMatch,
    findings: knobFiltered.kept,
    config: repo.config,
  });

  const finalIntent: IntentMatch = intentMatch;
  if (!summaryText) {
    summaryText =
      resolution.verdict === "APPROVE" ? "Looks good." : "See comments.";
  }

  const body = buildReviewBody({
    verdict: resolution.verdict,
    summary: summaryText,
    intentMatch: finalIntent,
    newerCommits: request.newerCommitsFlag ?? false,
    shortSha: pr.headSha.slice(0, 7),
    model,
  });

  const inlineComments: InlineComment[] = findingsOut.map((f) => ({
    path: f.path,
    line: f.line,
    ...(f.endLine && f.endLine > f.line ? { start_line: f.line, line: f.endLine } : {}),
    body: f.suggestion
      ? `${f.comment}\n\n\`\`\`suggestion\n${f.suggestion}\n\`\`\``
      : f.comment,
  }));

  const submitResult = await submitReview(token, {
    owner,
    repo: repoName,
    prNumber: request.prNumber,
    commitId: pr.headSha,
    event: resolution.verdict,
    body,
    comments: inlineComments,
  });

  if (!submitResult.inlinePosted) {
    for (const f of findingsOut) f.posted = false;
  }

  return persistReview({
    request,
    repoId: repo._id,
    verdict: resolution.verdict,
    verdictForced: resolution.forced,
    confidence,
    summary: summaryText,
    intentMatch: finalIntent,
    findings: findingsOut,
    headSha: pr.headSha,
    githubReviewId: submitResult.githubReviewId,
  });
}

async function persistReview(params: {
  request: ReviewRequestDoc;
  repoId: ObjectId;
  verdict: Verdict;
  verdictForced?: import("@/lib/db/types").VerdictForcedReason;
  confidence?: number;
  summary: string;
  intentMatch: IntentMatch;
  findings: Finding[];
  headSha: string;
  githubReviewId: number;
}): Promise<PipelineResult> {
  const reviews = await reviewsCollection();
  const reviewId = new ObjectId();
  await reviews.insertOne({
    _id: reviewId,
    requestId: params.request._id,
    repoId: params.repoId,
    prNumber: params.request.prNumber,
    verdict: params.verdict,
    ...(params.verdictForced ? { verdictForced: params.verdictForced } : {}),
    confidence: params.confidence ?? 1,
    summary: params.summary,
    intentMatch: params.intentMatch,
    findings: params.findings,
    lastReviewedSha: params.headSha,
    githubReviewId: params.githubReviewId,
    submittedAt: new Date(),
  });
  return {
    verdict: params.verdict,
    reviewId,
    findingsCount: params.findings.length,
  };
}
