'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ExternalLink, ChevronLeft, RefreshCw } from 'lucide-react';
import { fetcher, mutateJson, FetchError } from '@/lib/ui/swr';
import { toast } from '@/components/ui/Toast';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

type FindingSeverity = 'critical' | 'major' | 'minor' | 'nit';
type FindingCategory = 'bug' | 'security' | 'performance' | 'maintainability' | 'test' | 'scope';
type IntentMatchStatus = 'match' | 'partial' | 'mismatch';
type Verdict = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

type Finding = {
  path: string;
  line: number;
  endLine?: number;
  severity: FindingSeverity;
  category: FindingCategory;
  comment: string;
  suggestion?: string;
  blocking: boolean;
  posted: boolean;
};

type IntentMatch = {
  status: IntentMatchStatus;
  explanation: string;
};

type ReviewDoc = {
  verdict: Verdict;
  verdictForced?: string;
  confidence: number;
  summary: string;
  intentMatch: IntentMatch;
  findings: Finding[];
};

type ReviewRequestError = {
  stage: string;
  message: string;
  providerCode?: string;
};

type SkippedFile = {
  path: string;
  reason: string;
};

type ReviewRequestStats = {
  fileCount: number;
  filesReviewed: number;
  filesSkipped: SkippedFile[];
  additions: number;
  deletions: number;
  chunks: number;
};

type ReviewRequestTimings = {
  queuedMs?: number;
  processMs?: number;
  aiMs?: number;
  githubMs?: number;
};

type ReviewRequestDoc = {
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prUrl: string;
  status: string;
  kind: string;
  trigger: string;
  headSha: string;
  baseSha: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: ReviewRequestError;
  stats?: ReviewRequestStats;
  timings?: ReviewRequestTimings;
};

type AICall = {
  _id: string;
  provider: string;
  model: string;
  purpose: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'ok' | 'error';
  errorMessage?: string;
  createdAt: string;
  prompt: string;
  response: string;
};

type RequestDetail = {
  request: ReviewRequestDoc;
  review: ReviewDoc | null;
  aiCalls: AICall[];
  repoFullName: string;
};

type StatusVariant = 'success' | 'error' | 'info' | 'neutral';
type VerdictVariant = 'success' | 'error' | 'neutral';
type SeverityVariant = 'error' | 'warning' | 'neutral';
type IntentVariant = 'success' | 'warning' | 'error';

function statusVariant(status: string): StatusVariant {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'processing' || status === 'queued') return 'info';
  return 'neutral';
}

function verdictVariant(verdict: Verdict): VerdictVariant {
  if (verdict === 'APPROVE') return 'success';
  if (verdict === 'REQUEST_CHANGES') return 'error';
  return 'neutral';
}

function severityVariant(severity: FindingSeverity): SeverityVariant {
  if (severity === 'critical' || severity === 'major') return 'error';
  if (severity === 'minor') return 'warning';
  return 'neutral';
}

function intentVariant(status: IntentMatchStatus): IntentVariant {
  if (status === 'match') return 'success';
  if (status === 'partial') return 'warning';
  return 'error';
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sha7(sha: string): string {
  return sha.slice(0, 7);
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  nit: 3,
};

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-7 w-64" />
      <GlassCard>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
      </GlassCard>
      <GlassCard>
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </GlassCard>
    </div>
  );
}

export default function RequestDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const [retrying, setRetrying] = React.useState(false);

  const apiUrl = `/api/dashboard/requests/${id}`;
  const { data, error, isLoading, mutate } = useSWR<RequestDetail, FetchError>(
    apiUrl,
    fetcher
  );

  async function handleRetry(): Promise<void> {
    setRetrying(true);
    try {
      await mutateJson(`/api/dashboard/requests/${id}/retry`, 'POST');
      toast.success('Retry queued', 'The review request has been re-queued');
      await mutate();
    } catch (err) {
      const msg = err instanceof FetchError ? err.message : 'Something went wrong';
      toast.error('Retry failed', msg);
    } finally {
      setRetrying(false);
    }
  }

  if (isLoading) return <DetailSkeleton />;

  if (error) {
    if (error.status === 404) {
      return (
        <div className="flex flex-col gap-6 p-6">
          <GlassCard className="text-center py-12">
            <p className="text-[var(--text-muted)] font-medium">Request not found</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              This review request does not exist or you don&apos;t have access.
            </p>
            <Link href="/requests" className="mt-4 inline-block">
              <Button variant="secondary" size="sm">
                <ChevronLeft className="h-4 w-4" />
                Back to requests
              </Button>
            </Link>
          </GlassCard>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6 p-6">
        <GlassCard className="text-center py-8">
          <p className="text-sm text-[oklch(0.60_0.20_25)]">{error.message}</p>
        </GlassCard>
      </div>
    );
  }

  if (!data) return <DetailSkeleton />;

  const { request, review, aiCalls, repoFullName } = data;
  const sortedFindings = review
    ? [...review.findings].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      )
    : [];
  const totalCost = aiCalls.reduce((sum, c) => sum + c.costUsd, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start gap-3">
        <Link href="/requests">
          <Button variant="ghost" size="icon" aria-label="Back to requests">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-[var(--text)] truncate">
              #{request.prNumber} {request.prTitle}
            </h1>
            <Badge variant={statusVariant(request.status)}>
              {request.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
            <span>{repoFullName}</span>
            <span>&middot;</span>
            <span>by {request.prAuthor}</span>
            <span>&middot;</span>
            <span className="capitalize">{request.kind.replace(/_/g, ' ')} &middot; {request.trigger.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={request.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
          >
            Open PR
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRetry}
            loading={retrying}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry review
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard>
          <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[var(--text-muted)]">Created</dt>
            <dd className="text-[var(--text)]">
              <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>
            </dd>
            {request.startedAt && (
              <>
                <dt className="text-[var(--text-muted)]">Started</dt>
                <dd className="text-[var(--text)]">
                  <time dateTime={request.startedAt}>{formatDate(request.startedAt)}</time>
                </dd>
              </>
            )}
            {request.finishedAt && (
              <>
                <dt className="text-[var(--text-muted)]">Finished</dt>
                <dd className="text-[var(--text)]">
                  <time dateTime={request.finishedAt}>{formatDate(request.finishedAt)}</time>
                </dd>
              </>
            )}
            <dt className="text-[var(--text-muted)]">Head SHA</dt>
            <dd className="font-mono text-xs text-[var(--text)] tabular-nums">{sha7(request.headSha)}</dd>
            <dt className="text-[var(--text-muted)]">Base SHA</dt>
            <dd className="font-mono text-xs text-[var(--text)] tabular-nums">{sha7(request.baseSha)}</dd>
            {totalCost > 0 && (
              <>
                <dt className="text-[var(--text-muted)]">Total cost</dt>
                <dd className="tabular-nums text-[var(--text)]">{formatCost(totalCost)}</dd>
              </>
            )}
          </dl>
        </GlassCard>

        {request.stats && (
          <GlassCard>
            <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Stats</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[var(--text-muted)]">Files</dt>
              <dd className="tabular-nums text-[var(--text)]">
                {request.stats.filesReviewed} / {request.stats.fileCount} reviewed
              </dd>
              <dt className="text-[var(--text-muted)]">Changes</dt>
              <dd className="tabular-nums text-[var(--text)]">
                +{request.stats.additions} / -{request.stats.deletions}
              </dd>
              <dt className="text-[var(--text-muted)]">Chunks</dt>
              <dd className="tabular-nums text-[var(--text)]">{request.stats.chunks}</dd>
              {request.stats.filesSkipped.length > 0 && (
                <>
                  <dt className="text-[var(--text-muted)]">Skipped</dt>
                  <dd className="text-[var(--text)]">{request.stats.filesSkipped.length} file(s)</dd>
                </>
              )}
            </dl>
          </GlassCard>
        )}

        {request.timings && (
          <GlassCard>
            <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Timings</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {request.timings.queuedMs !== undefined && (
                <>
                  <dt className="text-[var(--text-muted)]">Queued</dt>
                  <dd className="tabular-nums text-[var(--text)]">{formatMs(request.timings.queuedMs)}</dd>
                </>
              )}
              {request.timings.processMs !== undefined && (
                <>
                  <dt className="text-[var(--text-muted)]">Process</dt>
                  <dd className="tabular-nums text-[var(--text)]">{formatMs(request.timings.processMs)}</dd>
                </>
              )}
              {request.timings.aiMs !== undefined && (
                <>
                  <dt className="text-[var(--text-muted)]">AI</dt>
                  <dd className="tabular-nums text-[var(--text)]">{formatMs(request.timings.aiMs)}</dd>
                </>
              )}
              {request.timings.githubMs !== undefined && (
                <>
                  <dt className="text-[var(--text-muted)]">GitHub</dt>
                  <dd className="tabular-nums text-[var(--text)]">{formatMs(request.timings.githubMs)}</dd>
                </>
              )}
            </dl>
          </GlassCard>
        )}
      </div>

      {request.error && (
        <GlassCard className="border border-[oklch(0.60_0.20_25/0.30)] bg-[oklch(0.60_0.20_25/0.05)]">
          <h2 className="text-sm font-semibold text-[oklch(0.50_0.20_25)] mb-2">Error</h2>
          <p className="text-xs text-[var(--text-muted)] mb-1">Stage: <span className="font-mono">{request.error.stage}</span></p>
          <p className="text-sm text-[var(--text)]">{request.error.message}</p>
          {request.error.providerCode && (
            <p className="text-xs text-[var(--text-muted)] mt-1">Code: <span className="font-mono">{request.error.providerCode}</span></p>
          )}
        </GlassCard>
      )}

      {review && (
        <GlassCard>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">AI Review</h2>
            <Badge variant={verdictVariant(review.verdict)}>{review.verdict.replace(/_/g, ' ')}</Badge>
            {review.verdictForced && (
              <Badge variant="warning">forced: {review.verdictForced.replace(/_/g, ' ')}</Badge>
            )}
            <span className="text-xs text-[var(--text-muted)] tabular-nums ml-auto">
              {Math.round(review.confidence * 100)}% confidence
            </span>
          </div>

          <p className="text-sm text-[var(--text)] mb-4 leading-relaxed">{review.summary}</p>

          <div className="flex items-start gap-2 mb-6 p-3 rounded-[var(--radius-panel)] bg-[var(--nav-hover)]">
            <Badge variant={intentVariant(review.intentMatch.status)} className="shrink-0 mt-0.5">
              {review.intentMatch.status}
            </Badge>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{review.intentMatch.explanation}</p>
          </div>

          {sortedFindings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
                Findings ({sortedFindings.length})
              </h3>
              <ul className="flex flex-col gap-3">
                {sortedFindings.map((finding) => (
                  <li
                    key={`${finding.path}-${finding.line}-${finding.category}-${finding.severity}`}
                    className="p-3 rounded-[var(--radius-panel)] bg-[var(--nav-hover)] flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={severityVariant(finding.severity)}>{finding.severity}</Badge>
                      <Badge variant="neutral">{finding.category}</Badge>
                      <code className="text-xs font-mono text-[var(--text-muted)] ml-auto">
                        {finding.path}:{finding.line}
                        {finding.endLine && finding.endLine !== finding.line ? `–${finding.endLine}` : ''}
                      </code>
                    </div>
                    <p className="text-sm text-[var(--text)] leading-relaxed">{finding.comment}</p>
                    {finding.suggestion && (
                      <pre className="text-xs whitespace-pre-wrap break-words p-2 rounded bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)] font-mono leading-relaxed">
                        {finding.suggestion}
                      </pre>
                    )}
                    <div className="flex gap-3 text-xs text-[var(--text-muted)]">
                      {finding.blocking && <span className="text-[oklch(0.50_0.20_25)]">blocking</span>}
                      {finding.posted && <span className="text-[oklch(0.50_0.15_142)]">posted</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>
      )}

      {aiCalls.length > 0 && (
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-[var(--glass-border)]">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              AI Calls ({aiCalls.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)] bg-[var(--nav-hover)]">
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)]">Provider / Model</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)]">Purpose</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-[var(--text-muted)] tabular-nums">Tokens</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-[var(--text-muted)] tabular-nums">Cost</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-[var(--text-muted)] tabular-nums">Latency</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {aiCalls.map((call) => (
                  <React.Fragment key={call._id}>
                    <tr className="hover:bg-[var(--nav-hover)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text)]">{call.provider}</div>
                        <div className="text-xs text-[var(--text-muted)] font-mono">{call.model}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{call.purpose}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)]">
                        {call.promptTokens + call.completionTokens}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)]">
                        {formatCost(call.costUsd)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)]">
                        {formatMs(call.latencyMs)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={call.status === 'ok' ? 'success' : 'error'}>
                          {call.status}
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="px-0 py-0">
                        <details className="group">
                          <summary className="cursor-pointer px-4 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--nav-hover)] select-none list-none flex items-center gap-1.5 transition-colors">
                            <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                            Show prompt &amp; response
                          </summary>
                          <div className="px-4 pb-3 flex flex-col gap-2">
                            {call.errorMessage && (
                              <p className="text-xs text-[oklch(0.50_0.20_25)]">Error: {call.errorMessage}</p>
                            )}
                            <div>
                              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Prompt</p>
                              <pre className="text-xs whitespace-pre-wrap break-words p-3 rounded-[var(--radius-panel)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text)] font-mono leading-relaxed max-h-64 overflow-y-auto">
                                {call.prompt}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Response</p>
                              <pre className="text-xs whitespace-pre-wrap break-words p-3 rounded-[var(--radius-panel)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text)] font-mono leading-relaxed max-h-64 overflow-y-auto">
                                {call.response}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
