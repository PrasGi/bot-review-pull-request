import type { ObjectId, Binary } from "mongodb";

export type ReviewProfile = "chill" | "normal" | "professional" | "expert";
export type AIProviderName = "anthropic" | "openai" | "glm" | "kimi";
export type Verdict = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export type ReviewRequestStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped_draft"
  | "superseded";

export type ReviewKind = "initial" | "re_review";
export type ReviewTrigger =
  | "review_requested"
  | "ready_for_review"
  | "manual_retry"
  | "auto_retry"
  | "follow_up";

export type FindingSeverity = "critical" | "major" | "minor" | "nit";
export type FindingCategory =
  | "bug"
  | "security"
  | "performance"
  | "maintainability"
  | "test"
  | "scope";

export type IntentMatchStatus = "match" | "partial" | "mismatch";

export interface InstallationDoc {
  _id: ObjectId;
  installationId: number;
  accountType: "User" | "Organization";
  accountLogin: string;
  accountId: number;
  repositorySelection: "all" | "selected";
  suspendedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingInstallationDoc {
  _id: string;
  accountLogin: string;
  accountType: "User" | "Organization";
  accountId: number;
  requesterLogin: string;
  requesterId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserConnectionDoc {
  _id: ObjectId;
  githubUserId: number;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  userTokenEncrypted: string;
  tokenExpiresAt: Date;
  refreshTokenEncrypted: string;
  refreshTokenExpiresAt: Date;
  installationIds: number[];
  reconnectRequired?: boolean;
  refreshLockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgInviteDoc {
  _id: ObjectId;
  /** sha256 of the invite token; the raw token is never stored. */
  tokenHash: string;
  /** Org or user login the owner is expected to install on (display only). */
  targetLogin: string;
  /** Lower-cased targetLogin, for matching webhook accounts. */
  targetLoginKey: string;
  /** The bot account that reviews PRs once the installation is linked. */
  reviewerConnectionId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  completedAt?: Date;
  installationId?: number;
  accountLogin?: string;
}

export interface AuthorProfileRule {
  login: string;
  profile: ReviewProfile;
}

export interface RepoConfig {
  provider: AIProviderName | null;
  model: string | null;
  reviewProfile: ReviewProfile;
  authorProfiles?: AuthorProfileRule[];
  autoVerdict: boolean;
  customGuidelines: string;
  ignorePatterns: string[];
  contextFiles: string[];
  maxChunks: number;
}

export interface RepoDoc {
  _id: ObjectId;
  installationRef: ObjectId;
  installationId: number;
  fullName: string;
  repoGithubId: number;
  enabled: boolean;
  config: RepoConfig;
  lastEventAt?: Date;
  removedFromInstallation?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface ReviewRequestStats {
  fileCount: number;
  filesReviewed: number;
  filesSkipped: SkippedFile[];
  additions: number;
  deletions: number;
  chunks: number;
}

export interface ReviewRequestTimings {
  queuedMs?: number;
  processMs?: number;
  aiMs?: number;
  githubMs?: number;
}

export type ReviewStage =
  | "preparing"
  | "fetching_pr"
  | "fetching_files"
  | "filtering"
  | "building_prompts"
  | "reviewing"
  | "evaluating_replies"
  | "finalizing"
  | "posting"
  | "saving";

/** Which branch of the pipeline a run takes; known once the files are filtered. */
export type ReviewPath = "full" | "reply" | "empty";

export interface ReviewProgressChunks {
  total: number;
  done: number;
  failed: number;
  running: number;
  repairs: number;
  /** Files that did not fit the token budget and are not reviewed. */
  unreviewedFiles: number;
  lastFinishedAt?: Date;
  /** Start time of each running chunk, keyed by chunk index; removed when it finishes. */
  startedAt?: Record<string, Date>;
  /** How each finished chunk ended, keyed by chunk index. */
  finished?: Record<string, "done" | "failed">;
}

/** Live progress written by the pipeline while a request is processing. */
export interface ReviewProgress {
  stage: ReviewStage;
  path?: ReviewPath;
  stageStartedAt: Date;
  updatedAt: Date;
  files?: { changed: number; kept: number; skipped: number };
  chunks?: ReviewProgressChunks;
  findings?: number;
  verdict?: Verdict;
  model?: { provider: AIProviderName; model: string };
  profile?: ReviewProfile;
  /** File names in each chunk, in chunk order. */
  chunkFiles?: string[][];
}

export interface ReviewRequestError {
  stage: string;
  message: string;
  providerCode?: string;
}

export interface ReviewRequestDoc {
  _id: ObjectId;
  deliveryId: string;
  retryOf?: ObjectId;
  userConnectionId: ObjectId;
  installationId: number;
  repoId: ObjectId;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prUrl: string;
  headSha: string;
  baseSha: string;
  kind: ReviewKind;
  trigger: ReviewTrigger;
  status: ReviewRequestStatus;
  cancelReason?: string;
  error?: ReviewRequestError;
  newerCommitsFlag?: boolean;
  reReviewRequestedFlag?: boolean;
  /** On a `skipped_draft` request: set when ready_for_review queued its review, so it runs once. */
  draftResumedAt?: Date;
  /** Set once the "review could not be completed" comment was posted on the PR. */
  failureNotifiedAt?: Date;
  stats?: ReviewRequestStats;
  timings?: ReviewRequestTimings;
  progress?: ReviewProgress;
  /** sha256 of the public live-progress link token. */
  liveTokenHash?: string;
  /** The "reviewing, follow the progress here" PR comment; deleted when the run ends. */
  statusComment?: { id: number; postedAt: Date; deletedAt?: Date };
  heartbeatAt?: Date;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface Finding {
  path: string;
  line: number;
  endLine?: number;
  severity: FindingSeverity;
  category: FindingCategory;
  comment: string;
  suggestion?: string;
  blocking: boolean;
  posted: boolean;
}

export interface PreviousFindingStatus {
  index: number;
  status: "resolved" | "unresolved" | "not_determinable";
  note?: string;
}

export interface IntentMatch {
  status: IntentMatchStatus;
  explanation: string;
}

export type VerdictForcedReason =
  | "auto_verdict_off"
  | "critical_findings"
  | "intent_mismatch";

export type ReviewDocKind =
  | "initial"
  | "re_review"
  | "re_review_fallback_full"
  | "re_review_reply";

export interface ReviewDoc {
  _id: ObjectId;
  requestId: ObjectId;
  repoId: ObjectId;
  prNumber: number;
  /** Metadata evaluated by this review. Optional for legacy documents. */
  prTitle?: string;
  prBody?: string | null;
  verdict: Verdict;
  verdictForced?: VerdictForcedReason;
  confidence: number;
  summary: string;
  intentMatch: IntentMatch;
  findings: Finding[];
  findingCommentIds?: number[];
  reviewKind?: ReviewDocKind;
  noop?: boolean;
  previousFindingStatuses?: PreviousFindingStatus[];
  lastEvaluatedReplyAt?: Date;
  lastReviewedSha: string;
  previousReviewId?: ObjectId;
  githubReviewId?: number;
  submittedAt: Date;
}

export type AICallPurpose =
  | "chunk-review"
  | "verdict"
  | "re-review"
  | "repair";

export interface AICallDoc {
  _id: ObjectId;
  requestId: ObjectId;
  repoId: ObjectId;
  userConnectionId: ObjectId;
  provider: AIProviderName;
  model: string;
  purpose: AICallPurpose;
  templateVersion: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  promptGz: Binary;
  responseGz: Binary;
  status: "ok" | "error";
  errorMessage?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface UsageDailyDoc {
  _id: string;
  date: string;
  repoId: ObjectId;
  userConnectionId: ObjectId;
  provider: AIProviderName;
  model: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  errorCount: number;
}

export interface ProcessedWebhookDoc {
  _id: string;
  event: string;
  processedAt: Date;
  expiresAt: Date;
}

export interface ModelPricing {
  provider: AIProviderName;
  model: string;
  inputPerM: number;
  outputPerM: number;
  updatedAt: Date;
}

export interface PromptTemplate {
  system: string;
  version: number;
  updatedAt: Date;
}

export interface SettingsDoc {
  _id: "global";
  adminEmail: string;
  adminPasswordHash: string;
  defaultProvider: AIProviderName;
  defaultModel: string;
  defaultReviewProfile: ReviewProfile;
  providerKeys: Partial<Record<AIProviderName, string>>;
  modelPricing: ModelPricing[];
  promptTemplates: Record<ReviewProfile, PromptTemplate>;
  dailyCostAlertUsd?: number;
  updatedAt: Date;
}

export interface SessionDoc {
  _id: string;
  createdAt: Date;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}
