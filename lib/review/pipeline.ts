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
import type {
  FindingOutput,
  IntentMatchOutput,
} from "@/lib/review/schemas";
import { completeChunkWithRepair } from "@/lib/review/chunk-completion";
import type { ParsedChunk } from "@/lib/review/chunk-completion";
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
import {
  buildReviewBody,
  composeSummary,
  type IncompleteReason,
} from "@/lib/review/summary";
import { recordAiCall } from "@/lib/review/audit";
import { TEMPLATE_VERSION } from "@/lib/prompts/defaults";
import { hasPullRequestMetadataChanged } from "@/lib/review/metadata";
import { NOOP_PROGRESS, type ProgressReporter } from "@/lib/review/progress-store";

// Budget: 96k input tokens per PR (12k x 8 chunks) so almost every PR gets FULL
// coverage; small PRs only spend what their diff needs. Smaller chunks are what
// bounds per-call latency — a reasoning model on a 20k chunk was measured at
// 80s+ and exhausted its whole output cap on hidden reasoning, returning nothing.
// 16k output leaves room for reasoning AND the JSON; 4.6k truncated either way.
// Chunks run CONCURRENCY_LIMIT at a time, so wall time is roughly
// ceil(chunks / CONCURRENCY_LIMIT) waves, kept under Vercel's 300s hard cap by
// the deadlines below. PRs beyond the budget get an honest partial review.
const CHUNK_TOKENS = 12_000;
const TOTAL_INPUT_BUDGET_TOKENS = 1_000_000;
const MAX_CHUNKS = 84;
const CONCURRENCY_LIMIT = 4;
// GLM latency is bursty: successful chunk calls measured over 72h sat at p50
// 126s / p95 216s / max 231s, so a 240s cap cut off the tail and turned slow
// calls into dropped chunks. 600s keeps the tail; a call that blows even this
// is a provider stall (zero tokens returned), not a slow answer.
const CALL_TIMEOUT_MS = 600_000;
const MAX_TOKENS_CHUNK = 16_384;

// Measured from pipeline start. RETRY stops new attempts early enough that a
// retry can still finish and be aggregated, so it must stay at or below
// GLOBAL - CALL_TIMEOUT; GLOBAL reserves the remainder for submitting the
// review. A review that says "I ran out of time" always beats one that never
// gets posted.
const RETRY_DEADLINE_MS = 1_200_000;
const GLOBAL_DEADLINE_MS = 1_800_000;

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
  prTitle: string;
  prBody: string | null;
}): Promise<ReviewScope> {
  const { request, token, owner, repoName, headSha, prTitle, prBody } = params;

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
    if (hasPullRequestMetadataChanged(prev, { title: prTitle, body: prBody })) {
      return full("re_review", prev);
    }

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
  progress: ProgressReporter;
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

  await params.progress.stage("posting");
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

export interface PipelineResult {
  verdict: Verdict;
  reviewId: ObjectId;
  findingsCount: number;
}

export async function runReviewPipeline(
  request: ReviewRequestDoc,
  heartbeat: () => Promise<void>,
  progress: ProgressReporter = NOOP_PROGRESS,
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

  await progress.stage("fetching_pr");
  const pr = await fetchPullRequest(token, owner, repoName, request.prNumber);
  if (pr.merged || pr.state === "closed") {
    throw new PrClosedError(pr.merged ? "pr_merged" : "pr_closed");
  }
  await heartbeat();

  await progress.stage("fetching_files");
  const delta = await resolveReviewScope({
    request,
    token,
    owner,
    repoName,
    headSha: pr.headSha,
    prTitle: pr.title,
    prBody: pr.body,
  });

  const { kept } = filterFiles(delta.files, repo.config.ignorePatterns);
  const fileCounts = {
    changed: delta.files.length,
    kept: kept.length,
    skipped: delta.files.length - kept.length,
  };
  await progress.stage("filtering", { files: fileCounts });

  const { provider, model, instance } = resolveModel(repo.config, settings);
  const pricing = settings.modelPricing.find(
    (p) => p.provider === provider && p.model === model,
  );

  if (kept.length === 0) {
    if (delta.kind === "re_review") {
      if (delta.previousReview) {
        await progress.stage("evaluating_replies", { path: "reply" });
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
          progress,
        });
        await heartbeat();
        await progress.stage("saving");
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
            prTitle: pr.title,
            prBody: pr.body,
            headSha: pr.headSha,
            githubReviewId: replyOutcome.githubReviewId,
            reviewKind: "re_review_reply",
            previousReviewId: delta.previousReview._id,
            previousFindingStatuses: replyOutcome.statuses,
            lastEvaluatedReplyAt: replyOutcome.lastEvaluatedReplyAt,
          });
        }
      }
      if (!delta.previousReview) {
        await progress.stage("saving", { path: "empty" });
      }
      return persistReview({
        request,
        repoId: repo._id,
        verdict: "COMMENT",
        summary: "No reviewable code changes since the last review.",
        intentMatch: { status: "match", explanation: "" },
        findings: [],
        prTitle: pr.title,
        prBody: pr.body,
        headSha: pr.headSha,
        reviewKind: delta.kind,
        previousReviewId: delta.previousReview?._id,
        noop: true,
      });
    }
    await progress.stage("posting", { path: "empty" });
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
    await progress.stage("saving");
    return persistReview({
      request,
      repoId: repo._id,
      verdict: "COMMENT",
      summary: "Nothing reviewable.",
      intentMatch: { status: "match", explanation: "No reviewable code." },
      findings: [],
      prTitle: pr.title,
      prBody: pr.body,
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

  await progress.stage("building_prompts", {
    path: "full",
    chunks: {
      total: chunks.length,
      done: 0,
      failed: 0,
      running: 0,
      repairs: 0,
      unreviewedFiles: unreviewed.length,
    },
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
  let deadlineHit = false;

  // A chunk that fails, times out, or is skipped for lack of time is dropped
  // (partial coverage) as long as one other chunk succeeds.
  const runChunk = async (
    chunk: (typeof chunks)[number],
    index: number,
  ): Promise<ParsedChunk | null> => {
    if (!chunk) return null;
    if (Date.now() - pipelineStart > GLOBAL_DEADLINE_MS) {
      deadlineHit = true;
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

    try {
      return await completeChunkWithRepair({
        provider: instance,
        completionParams: {
          model,
          messages,
          maxTokens: MAX_TOKENS_CHUNK,
          timeoutMs: CALL_TIMEOUT_MS,
          // Reasoning stays on for the review; repair only fixes formatting.
          thinking: "enabled",
          retryDeadlineAt: pipelineStart + RETRY_DEADLINE_MS,
        },
        repairDeadlineAt: pipelineStart + RETRY_DEADLINE_MS,
        audit: async (attempt) => {
          if (attempt.purpose === "repair") await progress.chunkRepaired();
          await recordAiCall({
            requestId: request._id,
            repoId: repo._id,
            userConnectionId: reviewer._id,
            provider,
            model,
            purpose: attempt.purpose,
            templateVersion: TEMPLATE_VERSION,
            prompt: attempt.messages
              .map((message) => `[${message.role}]\n${message.content}`)
              .join("\n\n---\n\n"),
            response: attempt.response,
            usage: attempt.usage,
            costUsd: computeCostUsd(attempt.usage, pricing),
            latencyMs: attempt.latencyMs,
            status: attempt.status,
            errorMessage: attempt.errorMessage,
          });
        },
      });
    } catch (error) {
      throw new Error(
        `chunk ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  };

  // Every chunk reports start and finish, so running/done/failed stay exact.
  const trackedChunk = async (
    chunk: (typeof chunks)[number],
    index: number,
  ): Promise<ParsedChunk | null> => {
    await progress.chunkStarted(index);
    try {
      const result = await runChunk(chunk, index);
      await progress.chunkFinished(index, result !== null);
      return result;
    } catch (error) {
      await progress.chunkFinished(index, false);
      throw error;
    }
  };

  await progress.stage("reviewing");
  const settled = await mapWithConcurrency(chunks, CONCURRENCY_LIMIT, trackedChunk);
  await heartbeat();
  await progress.stage("finalizing");

  const succeeded = settled.filter(
    (s): s is PromiseFulfilledResult<ParsedChunk> =>
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
    const output = s.value.output;
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

  // An incomplete read cannot support a judgement. Approving code we never saw
  // is unsafe, and demanding changes we cannot justify is noise — so we only
  // report what we found and say plainly why the review stopped early.
  const incomplete: IncompleteReason | null =
    unreviewed.length > 0
      ? "token_budget"
      : deadlineHit
        ? "time_budget"
        : partialCoverage
          ? "chunk_failed"
          : null;

  const verdict: Verdict = incomplete ? "COMMENT" : resolution.verdict;

  const finalIntent: IntentMatch = intentMatch;
  const summaryText = composeSummary({
    verdict,
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

  // Blocking findings each get their own inline thread — they need changes,
  // so they need to be individually addressable and trackable on re-review.
  // Non-blocking findings (nits, style) are folded into one collapsible
  // section in the body instead of piling up as separate comments.
  const blockingFindings = findingsOut.filter((f) => f.blocking);
  const nonBlockingFindings = findingsOut.filter((f) => !f.blocking);

  const body = buildReviewBody({
    verdict,
    summary: summaryText,
    caveat: resolution.caveat,
    ...(partial ? { partial } : {}),
    ...(incomplete ? { incomplete } : {}),
    ...(nonBlockingFindings.length > 0 ? { nonBlockingFindings } : {}),
    newerCommits: request.newerCommitsFlag ?? false,
    shortSha: pr.headSha.slice(0, 7),
  });

  const inlineComments: InlineComment[] = blockingFindings.map((f) => ({
    path: f.path,
    line: f.line,
    ...(f.endLine && f.endLine > f.line ? { start_line: f.line, line: f.endLine } : {}),
    body: f.suggestion
      ? `${f.comment}\n\n\`\`\`suggestion\n${f.suggestion}\n\`\`\``
      : f.comment,
  }));

  await progress.stage("posting", { findings: findingsOut.length, verdict });
  const submitResult = await submitReview(token, {
    owner,
    repo: repoName,
    prNumber: request.prNumber,
    commitId: pr.headSha,
    event: verdict,
    body,
    comments: inlineComments,
  });

  if (!submitResult.inlinePosted) {
    for (const f of blockingFindings) f.posted = false;
  }

  await progress.stage("saving");

  return persistReview({
    request,
    repoId: repo._id,
    verdict,
    verdictForced: resolution.forced,
    confidence,
    summary: summaryText,
    intentMatch: finalIntent,
    findings: findingsOut,
    prTitle: pr.title,
    prBody: pr.body,
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
  prTitle: string;
  prBody: string | null;
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
    prTitle: params.prTitle,
    prBody: params.prBody,
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
