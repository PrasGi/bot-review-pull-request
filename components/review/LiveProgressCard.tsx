'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { LiveIndicator } from '@/components/layout/Status';
import { ProgressBar } from '@/components/data/ProgressBar';
import type { LiveRequest } from '@/lib/dashboard/live';
import { formatElapsed } from '@/lib/review/progress';
import { LIVE_COPY as COPY } from '@/lib/review/progress-copy';
import { verdictTone, type Tone } from '@/lib/ui/tones';
import styles from './LiveProgressCard.module.css';

/** What the card needs; the dashboard and the public live page both provide it. */
export type LiveCardData = Omit<LiveRequest, 'id'>;

const STEP_GLYPH = { done: '✓', current: '●', pending: '○' } as const;

export const isActiveStatus = (status: string): boolean => status === 'processing' || status === 'queued';

export const elapsedSince = (iso: string | null, now: number): string | null =>
  iso ? formatElapsed(now - new Date(iso).getTime()) : null;

/** The result line of a finished review, and the tone of its badge. */
export function liveResult(data: LiveCardData): { text: string; tone: Tone } {
  const duration =
    data.startedAt && data.finishedAt
      ? formatElapsed(new Date(data.finishedAt).getTime() - new Date(data.startedAt).getTime())
      : '—';
  if (data.status === 'completed') {
    return data.result
      ? {
          text: COPY.result.completed(data.result.verdict, data.result.findings, duration),
          tone: verdictTone(data.result.verdict),
        }
      : { text: COPY.result.completedNoReview(duration), tone: 'success' };
  }
  if (data.status === 'failed') return { text: COPY.result.failed(data.error ?? 'unknown error'), tone: 'error' };
  return { text: COPY.result.cancelled(data.cancelReason ?? data.status.replace(/_/g, ' ')), tone: 'neutral' };
}

function Warning({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="prr-attn prr-attn--warning">
      <span className="prr-attn-icon" aria-hidden="true">
        <Icon name="alert" />
      </span>
      <div className="prr-attn-body">
        <p className="prr-hint">{children}</p>
      </div>
    </div>
  );
}

type LiveProgressCardProps = {
  data: LiveCardData;
  now: number;
  /** Extra controls next to the kind badge (the dashboard's switch button). */
  headerActions?: React.ReactNode;
  /** The link at the end of the action row ("Open request →"). */
  footerLink?: React.ReactNode;
  children?: React.ReactNode;
};

export function LiveProgressCard({ data, now, headerActions, footerLink, children }: LiveProgressCardProps): React.ReactElement {
  const active = isActiveStatus(data.status);
  const result = active ? null : liveResult(data);
  const chunks = data.chunks;
  const inReview = active && data.stage === 'reviewing';
  const settled = chunks ? (data.percent === 100 ? chunks.total : chunks.done + chunks.failed) : 0;
  const oldestFor = data.oldestChunk ? elapsedSince(data.oldestChunk.startedAt, now) : null;
  const heartbeatAgo = elapsedSince(data.heartbeatAt, now);

  return (
    <Card className={styles.card}>
      {/* Only stage changes and the result are announced; timers and counters are not. */}
      <p className="prr-sr" aria-live="polite">
        {result ? result.text : data.label}
      </p>

      <div className={styles.head}>
        <div className={styles.title}>
          <code className={styles.repo}>
            {data.repoFullName}#{data.prNumber}
          </code>
          <a href={data.prUrl} target="_blank" rel="noopener noreferrer" className={`prr-link ${styles.prTitle}`}>
            {data.prTitle}
            <Icon name="external" size={14} />
          </a>
        </div>
        <div className={styles.badges}>
          <Badge variant="neutral">{data.kind === 're_review' ? COPY.kind.re_review : COPY.kind.initial}</Badge>
          {headerActions}
        </div>
      </div>

      <div className={styles.action}>
        {result ? (
          <Badge variant={result.tone}>{result.text}</Badge>
        ) : (
          <>
            <LiveIndicator label={data.label} ariaLabel="Current review action" />
            {data.stageStartedAt && (
              <span className="prr-hint">{COPY.forDuration(elapsedSince(data.stageStartedAt, now) ?? '0s')}</span>
            )}
          </>
        )}
        {footerLink && <span className={styles.open}>{footerLink}</span>}
      </div>

      {chunks && data.percent !== null && (
        <div className={styles.progress}>
          <ProgressBar
            value={data.percent}
            label="Chunk review progress"
            valueText={COPY.chunkBar(settled, chunks.total, data.percent)}
          />
          <span className={styles.nums}>{COPY.chunkBar(settled, chunks.total, data.percent)}</span>
        </div>
      )}

      {active && (data.files || chunks) && (
        <ul className={styles.facts}>
          {data.files && <li>{COPY.files(data.files)}</li>}
          {chunks && inReview && <li>{COPY.chunks(chunks)}</li>}
          {inReview && data.oldestChunk && oldestFor && <li>{COPY.oldestChunk(data.oldestChunk.number, oldestFor)}</li>}
          {chunks?.lastFinishedAt && inReview && (
            <li>{COPY.lastChunk(elapsedSince(chunks.lastFinishedAt, now) ?? '0s')}</li>
          )}
          {chunks && chunks.repairs > 0 && <li>{COPY.repairs(chunks.repairs)}</li>}
          {chunks && chunks.unreviewedFiles > 0 && <li>{COPY.unreviewed(chunks.unreviewedFiles)}</li>}
        </ul>
      )}

      {data.status !== 'queued' && (
        <ol className={styles.stepper} aria-label="Review steps">
          {data.stepper.map((step) => (
            <li key={step.stage} className={styles.step} data-state={step.state}>
              <span aria-hidden="true">{STEP_GLYPH[step.state]}</span>
              <span>{step.label}</span>
              <span className="prr-sr">({step.state})</span>
            </li>
          ))}
        </ol>
      )}

      {inReview && data.slowChunk && data.oldestChunk && oldestFor && (
        <Warning>{COPY.slowChunk(data.oldestChunk.number, oldestFor)}</Warning>
      )}
      {data.stalled && heartbeatAgo && <Warning>{COPY.stalled(heartbeatAgo)}</Warning>}

      {children}
    </Card>
  );
}
