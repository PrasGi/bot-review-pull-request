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
  PreviousFindingStatus,
  RepoConfig,
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
import {
  fetchReviewInlineComments,
  fetchAllPrComments,
  postReviewCommentReply,
} from "@/lib/github/replies";
import {
  mapFindingsToReplies,
  evaluateReplies,
  computeReplyVerdict,
} from "@/lib/review/replies";
import type { AIProvider } from "@/lib/ai/provider";
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
import type {
  ChunkReviewOutput,
  FindingOutput,
  IntentMatchOutput,
} from "@/lib/review/schemas";
import {
  enforceKnobs,
  filterFindingsToValidLines,
  resolveVerdict,
} from "@/lib/review/verdict";
import { applyScopeGuard, collectRemovedLines } from "@/lib/review/scope-guard";
import { mapWithConcurrency } from "@/lib/review/concurrency";
import { resolveReviewProfile } from "@/lib/review/profile";
import { PrClosedError } from "@/lib/review/errors";
import { log } from "@/lib/logger";
import { buildReviewBody, composeSummary } from "@/lib/review/summary";
import { recordAiCall } from "@/lib/review/audit";
import { TEMPLATE_VERSION } from "@/lib/prompts/defaults";

// Budget: 96k input tokens per PR (12k x 8 chunks) so almost every PR gets FULL
// coverage; small PRs only spend what their diff needs. Smaller chunks are what
// bounds per-call latency — a reasoning model on a 20k chunk was measured at
// 80s+ and exhausted its whole output cap on hidden reasoning, returning nothing.
// 16k output leaves room for reasoning AND the JSON; 4.6k truncated either way.
// Chunks run CONCURRENCY_LIMIT at a time, so wall time is roughly
// ceil(chunks / CONCURRENCY_LIMIT) waves, kept under Vercel's 300s hard cap by
// the deadlines below. PRs beyond the budget get an honest partial review.
const CHUNK_TOKENS = 12_000;
const TOTAL_INPUT_BUDGET_TOKENS = 96_000;
const MAX_CHUNKS = 8;
const CONCURRENCY_LIMIT = 4;
const CALL_TIMEOUT_MS = 140_000;
const MAX_TOKENS_CHUNK = 16_384;

// Measured from pipeline start. RETRY stops new attempts early enough that a
// retry can still finish and be aggregated; GLOBAL reserves the remainder for
// submitting the review. Posting a partial review always beats a 300s timeout
// that posts nothing.
const RETRY_DEADLINE_MS = 200_000;
const GLOBAL_DEADLINE_MS = 240_000;

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

type ReplyReviewOutcome =
  | { kind: "noop" }
  | {
      kind: "reviewed";
      verdict: Verdict;
      verdictForced?: import("@/lib/db/types").VerdictForcedReason;
      summary: string;
      statuses: PreviousFindingStatus[];
      githubReviewId: number;
      lastEvaluatedReplyAt: Date;
    };

async function runReplyReview(params: {
  prev: ReviewDoc;
  token: string;
  owner: string;
  repoName: string;
  prNumber: number;
  headSha: string;
  botLogin: string;
  prTitle: string;
  config: RepoConfig;
  provider: AIProvider;
  model: string;
  providerName: import("@/lib/db/types").AIProviderName;
  pricing: import("@/lib/db/types").ModelPricing | undefined;
  requestId: ObjectId;
  repoId: ObjectId;
  userConnectionId: ObjectId;
}): Promise<ReplyReviewOutcome> {
  const { prev, token, owner, repoName, prNumber, botLogin } = params;

  if (prev.githubReviewId === undefined || prev.findings.length === 0) {
    return { kind: "noop" };
  }

  const [botComments, allComments] = await Promise.all([
    fetchReviewInlineComments(token, owner, repoName, prNumber, prev.githubReviewId),
    fetchAllPrComments(token, owner, repoName, prNumber),
  ]);

  const since = prev.lastEvaluatedReplyAt ?? prev.submittedAt;
  const bundles = mapFindingsToReplies({
    findings: prev.findings,
    botComments,
    allComments,
    botLogin,
    since,
  });
  if (bundles.length === 0) return { kind: "noop" };

  const lastEvaluatedReplyAt = new Date(
    Math.max(
      ...bundles.flatMap((b) =>
        b.replies.map((r) => new Date(r.created_at).getTime()),
      ),
    ),
  );

  const evaluation = await evaluateReplies({
    bundles,
    prTitle: params.prTitle,
    prIntentExplanation: prev.intentMatch.explanation,
    provider: params.provider,
    model: params.model,
  });

  await recordAiCall({
    requestId: params.requestId,
    repoId: params.repoId,
    userConnectionId: params.userConnectionId,
    provider: params.providerName,
    model: params.model,
    purpose: "re-review",
    templateVersion: TEMPLATE_VERSION,
    prompt: evaluation.prompt,
    response: evaluation.response,
    usage: { promptTokens: 0, completionTokens: 0 },
    costUsd: 0,
    latencyMs: 0,
    status: "ok",
  });

  const { verdict, forced, summary } = computeReplyVerdict({
    findings: prev.findings,
    statuses: evaluation.statuses,
    config: params.config,
  });

  const resolvedIndexes = new Set(
    evaluation.statuses.filter((s) => s.status === "resolved").map((s) => s.index),
  );
  for (const bundle of bundles) {
    if (!resolvedIndexes.has(bundle.findingIndex)) continue;
    try {
      await postReviewCommentReply(
        token,
        owner,
        repoName,
        prNumber,
        bundle.commentId,
        "Acknowledged — considering this resolved based on your reply. ✅",
      );
    } catch {
      // Non-fatal: the verdict review below is the authoritative signal.
    }
  }

  const submit = await submitReview(token, {
    owner,
    repo: repoName,
    prNumber,
    commitId: params.headSha,
    event: verdict,
    body: summary,
    comments: [],
  });

  return {
    kind: "reviewed",
    verdict,
    ...(forced ? { verdictForced: forced } : {}),
    summary,
    statuses: evaluation.statuses,
    githubReviewId: submit.githubReviewId,
    lastEvaluatedReplyAt,
  };
}

function parseChunkOutput(raw: string): ChunkReviewOutput {
  const json: unknown = JSON.parse(raw);
  return chunkReviewSchema.parse(json);
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
  const pipelineStart = Date.now();
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
  if (pr.merged || pr.state === "closed") {
    throw new PrClosedError(pr.merged ? "pr_merged" : "pr_closed");
  }
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
      if (delta.previousReview) {
        const replyOutcome = await runReplyReview({
          prev: delta.previousReview,
          token,
          owner,
          repoName,
          prNumber: request.prNumber,
          headSha: pr.headSha,
          botLogin: reviewer.githubLogin,
          prTitle: pr.title,
          config: repo.config,
          provider: instance,
          model,
          providerName: provider,
          pricing,
          requestId: request._id,
          repoId: repo._id,
          userConnectionId: reviewer._id,
        });
        await heartbeat();
        if (replyOutcome.kind === "reviewed") {
          return persistReview({
            request,
            repoId: repo._id,
            verdict: replyOutcome.verdict,
            ...(replyOutcome.verdictForced
              ? { verdictForced: replyOutcome.verdictForced }
              : {}),
            summary: replyOutcome.summary,
            intentMatch: delta.previousReview.intentMatch,
            findings: [],
            headSha: pr.headSha,
            githubReviewId: replyOutcome.githubReviewId,
            reviewKind: "re_review_reply",
            previousReviewId: delta.previousReview._id,
            previousFindingStatuses: replyOutcome.statuses,
            lastEvaluatedReplyAt: replyOutcome.lastEvaluatedReplyAt,
          });
        }
      }
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
    maxChunks: Math.min(repo.config.maxChunks, MAX_CHUNKS),
  });

  const reviewProfile = resolveReviewProfile(repo.config, pr.authorLogin);
  const systemPrompt = buildSystemPrompt(
    settings.promptTemplates[reviewProfile].system,
    reviewProfile,
    repo.config.customGuidelines,
    chunks.length === 1,
  );

  const allFindings: FindingOutput[] = [];
  let confidence = 0.5;
  let intentMatch: IntentMatchOutput = {
    status: "match",
    explanation: "",
  };
  let modelSummary = "";
  let verdictReason = "";
  const chunkSummaries: string[] = [];
  const intentNotes: string[] = [];

  const newHunkLinesByPath = new Map<string, Set<number>>();
  let partialCoverage = false;

  // A chunk that fails, times out, or is skipped for lack of time is dropped
  // (partial coverage) as long as one other chunk succeeds.
  const runChunk = async (
    chunk: (typeof chunks)[number],
    index: number,
  ): Promise<ReturnType<typeof parseChunkOutput> | null> => {
    if (!chunk) return null;
    if (Date.now() - pipelineStart > GLOBAL_DEADLINE_MS) {
      throw new Error(`chunk ${index + 1}: skipped, past global deadline`);
    }
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
      // Reasoning stays ON: with it disabled the model missed a planted
      // open-redirect and emitted line numbers that our hunk filter drops.
      thinking: "enabled",
      retryDeadlineAt: pipelineStart + RETRY_DEADLINE_MS,
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

  const settled = await mapWithConcurrency(chunks, CONCURRENCY_LIMIT, runChunk);
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
    if (output.summary) modelSummary = output.summary;
    if (output.verdictReason) verdictReason = output.verdictReason;
    if (output.chunkSummary) chunkSummaries.push(output.chunkSummary);
    if (output.intentNotes) intentNotes.push(output.intentNotes);
  }

  // OUTPUT_SCHEMA_CHUNK asks for `intentNotes`, not `intentMatch`, so without
  // this every multi-chunk review stores an empty intent explanation.
  if (!intentMatch.explanation && intentNotes.length > 0) {
    intentMatch = {
      ...intentMatch,
      explanation: intentNotes.join(" ").slice(0, 400),
    };
  }

  const lineFiltered = filterFindingsToValidLines(
    allFindings,
    newHunkLinesByPath,
  );
  const knobFiltered = enforceKnobs(lineFiltered.kept, reviewProfile);
  const scoped = applyScopeGuard(knobFiltered.kept, {
    profile: reviewProfile,
    removedDiffText: collectRemovedLines(kept.map((f) => f.patch)),
    customGuidelines: repo.config.customGuidelines,
  });
  if (
    scoped.droppedCount > 0 ||
    scoped.downgradedCount > 0 ||
    scoped.securityKeptCount > 0
  ) {
    log.info("review.scope_guard", {
      requestId: request._id.toHexString(),
      dropped: scoped.droppedCount,
      downgraded: scoped.downgradedCount,
      securityKept: scoped.securityKeptCount,
    });
  }
  const findingsOut: Finding[] = scoped.kept.map((f) => ({
    ...f,
    posted: true,
  }));

  const resolution = resolveVerdict({
    intentMatch,
    findings: scoped.kept,
    config: repo.config,
  });

  const finalIntent: IntentMatch = intentMatch;
  const summaryText = composeSummary({
    verdict: resolution.verdict,
    summary: modelSummary,
    verdictReason,
    chunkSummaries,
  });

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
  previousFindingStatuses?: PreviousFindingStatus[];
  lastEvaluatedReplyAt?: Date;
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
    ...(params.previousFindingStatuses
      ? { previousFindingStatuses: params.previousFindingStatuses }
      : {}),
    ...(params.lastEvaluatedReplyAt
      ? { lastEvaluatedReplyAt: params.lastEvaluatedReplyAt }
      : {}),
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
