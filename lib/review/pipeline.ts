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
  ReviewDoc,
  ReviewDocKind,
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
import { fetchCompare } from "@/lib/github/compare";
import type { PrFile } from "@/lib/review/diff-format";
import { formatFilesForPrompt } from "@/lib/review/diff-format";
import { filterFiles } from "@/lib/review/filter";
import { chunkFiles } from "@/lib/review/chunk";
import { effectiveBudget } from "@/lib/review/tokenizer";
import { resolveModel } from "@/lib/ai/factory";
import { computeCostUsd } from "@/lib/ai/provider";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildMessages,
  type PreviousFindingLine,
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

// Latency contract: webhook -> submitted review in <=180s. GLM-4.7 latency is
// dominated by INPUT size, so small chunks (fast per-call) run in parallel and
// TOTAL input work is capped — huge PRs get an honest partial review.
const CHUNK_TOKENS = 4_000;
const TOTAL_INPUT_BUDGET_TOKENS = 24_000;
const MAX_PARALLEL_CHUNKS = 3;
const CALL_TIMEOUT_MS = 60_000;
const MAX_TOKENS_CHUNK = 1536;

function splitRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/");
  return { owner: owner ?? "", repo: repo ?? "" };
}

interface ReviewScope {
  files: PrFile[];
  kind: ReviewDocKind;
  previousReview: ReviewDoc | null;
  previousFindings: PreviousFindingLine[];
}

async function fetchFullFiles(
  token: string,
  owner: string,
  repoName: string,
  prNumber: number,
): Promise<PrFile[]> {
  return fetchPullRequestFiles(token, owner, repoName, prNumber);
}

async function resolveReviewScope(params: {
  request: ReviewRequestDoc;
  token: string;
  owner: string;
  repoName: string;
  headSha: string;
}): Promise<ReviewScope> {
  const { request, token, owner, repoName, headSha } = params;

  const full = async (
    kind: ReviewDocKind,
    previousReview: ReviewDoc | null,
  ): Promise<ReviewScope> => ({
    files: await fetchFullFiles(token, owner, repoName, request.prNumber),
    kind,
    previousReview,
    previousFindings: [],
  });

  if (request.kind !== "re_review") return full("initial", null);

  const reviews = await reviewsCollection();
  const prev = await reviews.findOne(
    { repoId: request.repoId, prNumber: request.prNumber },
    { sort: { submittedAt: -1 } },
  );
  if (!prev || !prev.lastReviewedSha) return full("re_review_fallback_full", null);
  if (prev.lastReviewedSha === headSha) {
    return {
      files: [],
      kind: "re_review",
      previousReview: prev,
      previousFindings: [],
    };
  }

  const compare = await fetchCompare(
    token,
    owner,
    repoName,
    prev.lastReviewedSha,
    headSha,
  );
  if (!compare.ok) return full("re_review_fallback_full", prev);

  const previousFindings: PreviousFindingLine[] = prev.findings.map((f) => ({
    path: f.path,
    line: f.line,
    severity: f.severity,
    blocking: f.blocking,
    comment: f.comment,
  }));

  return {
    files: compare.files,
    kind: "re_review",
    previousReview: prev,
    previousFindings,
  };
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

  const delta = await resolveReviewScope({
    request,
    token,
    owner,
    repoName,
    headSha: pr.headSha,
  });

  const { kept } = filterFiles(delta.files, repo.config.ignorePatterns);

  const { provider, model, instance } = resolveModel(repo.config, settings);
  const pricing = settings.modelPricing.find(
    (p) => p.provider === provider && p.model === model,
  );

  if (kept.length === 0) {
    if (delta.kind === "re_review") {
      return persistReview({
        request,
        repoId: repo._id,
        verdict: "COMMENT",
        summary: "No reviewable code changes since the last review.",
        intentMatch: { status: "match", explanation: "" },
        findings: [],
        headSha: pr.headSha,
        reviewKind: delta.kind,
        previousReviewId: delta.previousReview?._id,
        noop: true,
      });
    }
    const body = buildReviewBody({
      verdict: "COMMENT",
      summary: "No reviewable code changes (only lockfiles/generated files).",
      newerCommits: request.newerCommitsFlag ?? false,
      shortSha: pr.headSha.slice(0, 7),
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
      reviewKind: delta.kind,
      githubReviewId: result.githubReviewId,
    });
  }

  const { chunks, unreviewed } = chunkFiles(kept, {
    chunkTokens: effectiveBudget(CHUNK_TOKENS, provider),
    totalInputBudget: effectiveBudget(TOTAL_INPUT_BUDGET_TOKENS, provider),
    maxChunks: Math.min(repo.config.maxChunks, MAX_PARALLEL_CHUNKS),
  });

  const systemPrompt = buildSystemPrompt(
    settings.promptTemplates[repo.config.reviewProfile].system,
    repo.config.reviewProfile,
    repo.config.customGuidelines,
    chunks.length === 1,
  );

  const allFindings: FindingOutput[] = [];
  let confidence = 0.5;
  let intentMatch: IntentMatchOutput = {
    status: "match",
    explanation: "",
  };
  let summaryText = "";

  const newHunkLinesByPath = new Map<string, Set<number>>();
  let partialCoverage = false;

  // Chunks run in PARALLEL: wall time = max(call latency), not the sum. A chunk
  // that fails or times out is dropped (partial coverage) as long as one succeeds.
  const runChunk = async (
    chunk: (typeof chunks)[number],
    index: number,
  ): Promise<ReturnType<typeof parseChunkOutput> | null> => {
    if (!chunk) return null;
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
      chunkIndex: index + 1,
      chunkTotal: chunks.length,
      filesInChunk: chunk.files.length,
      filesTotal: kept.length,
      formattedDiff: formatted.rendered,
      ...(index === 0 && delta.previousFindings.length > 0
        ? { previousFindings: delta.previousFindings }
        : {}),
    });
    const messages = buildMessages(systemPrompt, userPrompt);

    const started = Date.now();
    const completion = await instance.complete({
      model,
      messages,
      maxTokens: MAX_TOKENS_CHUNK,
      timeoutMs: CALL_TIMEOUT_MS,
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

    if (!output) throw new Error(`chunk ${index + 1}: ${parseError}`);
    return output;
  };

  const settled = await Promise.allSettled(
    chunks.map((chunk, index) => runChunk(chunk, index)),
  );
  await heartbeat();

  const succeeded = settled.filter(
    (s): s is PromiseFulfilledResult<ReturnType<typeof parseChunkOutput>> =>
      s.status === "fulfilled" && s.value !== null,
  );
  if (succeeded.length === 0) {
    const firstError = settled.find(
      (s): s is PromiseRejectedResult => s.status === "rejected",
    );
    throw new Error(
      `all chunks failed: ${firstError ? String(firstError.reason) : "unknown"}`,
    );
  }
  if (succeeded.length < chunks.length) partialCoverage = true;

  for (const s of succeeded) {
    const output = s.value;
    allFindings.push(...output.findings);
    if (output.confidence !== undefined) confidence = output.confidence;
    if (output.intentMatch) intentMatch = output.intentMatch;
    if (output.summary) summaryText = output.summary;
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
    intentMatch,
    findings: knobFiltered.kept,
    config: repo.config,
  });

  const finalIntent: IntentMatch = intentMatch;
  if (!summaryText) {
    summaryText =
      resolution.verdict === "APPROVE" ? "Looks good." : "See comments.";
  }

  const skippedForBudget = [
    ...unreviewed.map((f) => f.filename),
    ...(partialCoverage
      ? ["(some files skipped after a chunk timed out)"]
      : []),
  ];
  const reviewedCount = kept.length - unreviewed.length;
  const partial =
    skippedForBudget.length > 0
      ? {
          totalFiles: kept.length,
          reviewedCount,
          skippedFiles: skippedForBudget,
        }
      : undefined;

  const body = buildReviewBody({
    verdict: resolution.verdict,
    summary: summaryText,
    caveat: resolution.caveat,
    ...(partial ? { partial } : {}),
    newerCommits: request.newerCommitsFlag ?? false,
    shortSha: pr.headSha.slice(0, 7),
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
    reviewKind: delta.kind,
    previousReviewId: delta.previousReview?._id,
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
  githubReviewId?: number;
  reviewKind?: ReviewDocKind;
  previousReviewId?: ObjectId;
  noop?: boolean;
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
    ...(params.reviewKind ? { reviewKind: params.reviewKind } : {}),
    ...(params.previousReviewId
      ? { previousReviewId: params.previousReviewId }
      : {}),
    ...(params.noop ? { noop: true } : {}),
    lastReviewedSha: params.headSha,
    ...(params.githubReviewId !== undefined
      ? { githubReviewId: params.githubReviewId }
      : {}),
    submittedAt: new Date(),
  });
  return {
    verdict: params.verdict,
    reviewId,
    findingsCount: params.findings.length,
  };
}
