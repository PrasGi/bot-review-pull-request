'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, mutateJson, FetchError } from '@/lib/ui/swr';
import { requestStatusTone, verdictTone } from '@/lib/ui/tones';
import { toast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader, SectionHeading } from '@/components/layout/PageHeader';
import { Grid } from '@/components/layout/Grid';
import { DescriptionList, type DescriptionItem } from '@/components/data/DescriptionList';
import { EmptyState, ErrorState } from '@/components/data/States';
import { FindingCard } from '@/components/review/FindingCard';
import { CodeBlock } from '@/components/review/CodeBlock';
import { Disclosure } from '@/components/review/Disclosure';
import styles from './page.module.css';

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

const INTENT_TONE: Record<IntentMatchStatus, BadgeVariant> = {
  match: 'success',
  partial: 'warning',
  mismatch: 'error',
};

const INTENT_MARK: Record<IntentMatchStatus, string> = { match: '✓', partial: '!', mismatch: '✕' };

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

const BACK_LINK = (
  <Link href="/requests" className={buttonClass('secondary', 'icon')} aria-label="Back to requests">
    <Icon name="arrowLeft" />
  </Link>
);

function DetailSkeleton(): React.ReactElement {
  return (
    <div role="status" aria-label="Loading request" className={styles.skeleton}>
      <Skeleton style={{ height: 36, width: 320 }} />
      <Grid variant="pair">
        <Card>
          <Skeleton style={{ height: 14, width: 96, marginBottom: 16 }} />
          <Skeleton style={{ height: 12, width: '80%', marginBottom: 10 }} />
          <Skeleton style={{ height: 12, width: '60%', marginBottom: 10 }} />
          <Skeleton style={{ height: 12, width: '70%' }} />
        </Card>
        <Card>
          <Skeleton style={{ height: 14, width: 96, marginBottom: 16 }} />
          <Skeleton style={{ height: 12, width: '75%', marginBottom: 10 }} />
          <Skeleton style={{ height: 12, width: '55%' }} />
        </Card>
      </Grid>
    </div>
  );
}

function compact(items: (DescriptionItem | false | '' | undefined)[]): DescriptionItem[] {
  return items.filter((item): item is DescriptionItem => Boolean(item));
}

export default function RequestDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const [retrying, setRetrying] = React.useState(false);

  const apiUrl = `/api/dashboard/requests/${id}`;
  const { data, error, isLoading, mutate } = useSWR<RequestDetail, FetchError>(apiUrl, fetcher);

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
        <Card>
          <EmptyState
            title="Request not found"
            description="This review request does not exist or you don't have access."
            action={
              <Link href="/requests" className={buttonClass('secondary', 'sm')}>
                <Icon name="arrowLeft" size={14} />
                Back to requests
              </Link>
            }
          />
        </Card>
      );
    }
    return (
      <>
        <PageHeader title="Review request" back={BACK_LINK} />
        <ErrorState title="Could not load request" message={error.message} onRetry={() => void mutate()} />
      </>
    );
  }

  if (!data) return <DetailSkeleton />;

  const { request, review, aiCalls, repoFullName } = data;
  const sortedFindings = review
    ? [...review.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    : [];
  const totalCost = aiCalls.reduce((sum, c) => sum + c.costUsd, 0);
  const timings = request.timings;

  return (
    <>
      <PageHeader
        back={BACK_LINK}
        kicker={repoFullName}
        title={`#${request.prNumber} ${request.prTitle}`}
        badge={<Badge variant={requestStatusTone(request.status)}>{request.status.replace(/_/g, ' ')}</Badge>}
        description={
          <>
            by <code>@{request.prAuthor}</code> · {request.kind.replace(/_/g, ' ')} · {request.trigger.replace(/_/g, ' ')}
          </>
        }
        actions={
          <>
            <a href={request.prUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'sm')}>
              Open PR
              <Icon name="external" size={14} />
            </a>
            <Button variant="secondary" size="sm" onClick={handleRetry} loading={retrying}>
              {!retrying && <Icon name="refresh" size={14} />}
              Retry review
            </Button>
          </>
        }
      />

      <Grid variant="pair">
        <Card>
          <DescriptionList
            title="Details"
            items={compact([
              { term: 'Created', value: <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time> },
              request.startedAt && {
                term: 'Started',
                value: <time dateTime={request.startedAt}>{formatDate(request.startedAt)}</time>,
              },
              request.finishedAt && {
                term: 'Finished',
                value: <time dateTime={request.finishedAt}>{formatDate(request.finishedAt)}</time>,
              },
              { term: 'Head SHA', value: sha7(request.headSha), mono: true },
              { term: 'Base SHA', value: sha7(request.baseSha), mono: true },
              totalCost > 0 && { term: 'Total cost', value: formatCost(totalCost), mono: true },
            ])}
          />
        </Card>

        {(request.stats || timings) && (
          <Card className={styles.stack}>
            {request.stats && (
              <DescriptionList
                title="Stats"
                items={compact([
                  {
                    term: 'Files',
                    value: `${request.stats.filesReviewed} / ${request.stats.fileCount} reviewed`,
                    mono: true,
                  },
                  { term: 'Changes', value: `+${request.stats.additions} / -${request.stats.deletions}`, mono: true },
                  { term: 'Chunks', value: String(request.stats.chunks), mono: true },
                  request.stats.filesSkipped.length > 0 && {
                    term: 'Skipped',
                    value: `${request.stats.filesSkipped.length} file(s)`,
                    mono: true,
                  },
                ])}
              />
            )}
            {timings && (
              <DescriptionList
                title="Timings"
                items={compact([
                  timings.queuedMs !== undefined && { term: 'Queued', value: formatMs(timings.queuedMs), mono: true },
                  timings.processMs !== undefined && { term: 'Process', value: formatMs(timings.processMs), mono: true },
                  timings.aiMs !== undefined && { term: 'AI', value: formatMs(timings.aiMs), mono: true },
                  timings.githubMs !== undefined && { term: 'GitHub', value: formatMs(timings.githubMs), mono: true },
                ])}
              />
            )}
          </Card>
        )}
      </Grid>

      {request.error && (
        <ErrorState
          title={`Failed at ${request.error.stage}`}
          message={
            request.error.providerCode
              ? `${request.error.message} (code ${request.error.providerCode})`
              : request.error.message
          }
        />
      )}

      {review && (
        <Card>
          <SectionHeading
            action={<code className={styles.confidence}>{Math.round(review.confidence * 100)}% confidence</code>}
          >
            AI review
            <Badge variant={verdictTone(review.verdict)}>{review.verdict}</Badge>
            {review.verdictForced && <Badge variant="warning">forced: {review.verdictForced}</Badge>}
          </SectionHeading>

          <p className={styles.summary}>{review.summary}</p>

          <div className={styles.intent}>
            <Badge variant={INTENT_TONE[review.intentMatch.status]}>
              {INTENT_MARK[review.intentMatch.status]} {review.intentMatch.status}
            </Badge>
            <p className="prr-hint">{review.intentMatch.explanation}</p>
          </div>

          {sortedFindings.length > 0 && (
            <section aria-label="Findings">
              <SectionHeading as="h3" count={sortedFindings.length}>
                Findings
              </SectionHeading>
              <ul className={styles.findings}>
                {sortedFindings.map((finding) => (
                  <li key={`${finding.path}-${finding.line}-${finding.category}-${finding.severity}`}>
                    <FindingCard
                      severity={finding.severity}
                      category={finding.category}
                      location={`${finding.path}:${finding.line}${
                        finding.endLine && finding.endLine !== finding.line ? `–${finding.endLine}` : ''
                      }`}
                      comment={finding.comment}
                      suggestion={finding.suggestion}
                      blocking={finding.blocking}
                      posted={finding.posted}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Card>
      )}

      {aiCalls.length > 0 && (
        <section className="prr-table-card" aria-label="AI calls">
          <div className="prr-table-toolbar">
            <h2 className="prr-section-title">
              AI calls <span className="prr-section-count">{aiCalls.length}</span>
            </h2>
          </div>
          <div className="prr-table-scroll">
            <table className="prr-table">
              <thead>
                <tr>
                  <th scope="col">Provider / model</th>
                  <th scope="col">Purpose</th>
                  <th scope="col" className="is-right">Tokens</th>
                  <th scope="col" className="is-right">Cost</th>
                  <th scope="col" className="is-right">Latency</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {aiCalls.map((call) => (
                  <React.Fragment key={call._id}>
                    <tr>
                      <td>
                        <div className="prr-cell-title">{call.provider}</div>
                        <code className="prr-cell-sub">{call.model}</code>
                      </td>
                      <td className="is-muted">{call.purpose}</td>
                      <td className="is-right is-mono">{(call.promptTokens + call.completionTokens).toLocaleString()}</td>
                      <td className="is-right is-mono">{formatCost(call.costUsd)}</td>
                      <td className="is-right is-mono">{formatMs(call.latencyMs)}</td>
                      <td>
                        <Badge variant={call.status === 'ok' ? 'success' : 'error'}>
                          {call.status === 'ok' ? '✓ ok' : '✕ error'}
                        </Badge>
                      </td>
                    </tr>
                    <tr className={styles.detailRow}>
                      <td colSpan={6}>
                        <Disclosure summary="Show prompt & response">
                          {call.errorMessage && <p className="prr-error">{call.errorMessage}</p>}
                          <CodeBlock label="Prompt" maxHeight={256}>
                            {call.prompt}
                          </CodeBlock>
                          <CodeBlock label="Response" maxHeight={256}>
                            {call.response}
                          </CodeBlock>
                        </Disclosure>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
