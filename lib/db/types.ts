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

export interface AccountDoc {
  _id: ObjectId;
  githubLogin: string;
  githubUserId: number;
  displayName: string;
  avatarUrl?: string;
  installationId: number;
  userTokenEncrypted: string;
  tokenExpiresAt: Date;
  refreshTokenEncrypted: string;
  refreshTokenExpiresAt: Date;
  reconnectRequired?: boolean;
  refreshLockUntil?: Date;
  repositorySelection: "all" | "selected";
  createdAt: Date;
  updatedAt: Date;
}

export interface RepoConfig {
  provider: AIProviderName | null;
  model: string | null;
  reviewProfile: ReviewProfile;
  autoVerdict: boolean;
  confidenceThreshold: number;
  customGuidelines: string;
  ignorePatterns: string[];
  contextFiles: string[];
  maxChunks: number;
}

export interface RepoDoc {
  _id: ObjectId;
  accountId: ObjectId;
  fullName: string;
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

export interface ReviewRequestError {
  stage: string;
  message: string;
  providerCode?: string;
}

export interface ReviewRequestDoc {
  _id: ObjectId;
  deliveryId: string;
  retryOf?: ObjectId;
  accountId: ObjectId;
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
  stats?: ReviewRequestStats;
  timings?: ReviewRequestTimings;
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
  | "low_confidence"
  | "auto_verdict_off"
  | "critical_findings"
  | "intent_mismatch";

export interface ReviewDoc {
  _id: ObjectId;
  requestId: ObjectId;
  repoId: ObjectId;
  prNumber: number;
  verdict: Verdict;
  verdictForced?: VerdictForcedReason;
  confidence: number;
  summary: string;
  intentMatch: IntentMatch;
  findings: Finding[];
  resolvedFindings?: PreviousFindingStatus[];
  unresolvedFindings?: PreviousFindingStatus[];
  lastReviewedSha: string;
  previousReviewId?: ObjectId;
  githubReviewId: number;
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
  accountId: ObjectId;
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
  accountId: ObjectId;
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
