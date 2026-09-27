'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { LiveIndicator } from '@/components/layout/Status';
import { ErrorState } from '@/components/data/States';
import { ProgressBar } from '@/components/data/ProgressBar';
import type { LiveRequest, LiveResponse } from '@/lib/dashboard/live';
import { formatElapsed } from '@/lib/review/progress';
import { LIVE_COPY as COPY } from '@/lib/review/progress-copy';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { verdictTone } from '@/lib/ui/tones';
import styles from './LiveReview.module.css';

const RESULT_MS = 5_000;
const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 5_000;
const STEP_GLYPH = { done: '✓', current: '●', pending: '○' } as const;

const isActive = (status: string): boolean => status === 'processing' || status === 'queued';

/** Re-renders every second so elapsed times move between polls. */
function useNow(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const since = (iso: string | null, now: number): string | null =>
  iso ? formatElapsed(now - new Date(iso).getTime()) : null;

function ResultLine({ focus }: { focus: LiveRequest }): React.ReactElement {
  const duration = focus.startedAt && focus.finishedAt
    ? formatElapsed(new Date(focus.finishedAt).getTime() - new Date(focus.startedAt).getTime())
    : '—';
  if (focus.status === 'completed') {
    return focus.result ? (
      <Badge variant={verdictTone(focus.result.verdict)}>
        {COPY.result.completed(focus.result.verdict, focus.result.findings, duration)}
      </Badge>
    ) : (
      <Badge variant="success">{COPY.result.completedNoReview(duration)}</Badge>
    );
  }
  if (focus.status === 'failed') {
    return <Badge variant="error">{COPY.result.failed(focus.error ?? 'unknown error')}</Badge>;
  }
  return <Badge variant="neutral">{COPY.result.cancelled(focus.cancelReason ?? focus.status.replace(/_/g, ' '))}</Badge>;
}

function FocusCard({ focus, othersRunning, now }: { focus: LiveRequest; othersRunning: number; now: number }): React.ReactElement {
  const active = isActive(focus.status);
  const stageFor = since(focus.stageStartedAt, now);
  const steps = focus.steps;
  const heartbeatAgo = since(focus.heartbeatAt, now);

  return (
    <Card className={styles.card} aria-live="polite">
      <div className={styles.head}>
        <div className={styles.title}>
          <code className={styles.repo}>
            {focus.repoFullName}#{focus.prNumber}
          </code>
          <a href={focus.prUrl} target="_blank" rel="noopener noreferrer" className={`prr-link ${styles.prTitle}`}>
            {focus.prTitle}
            <Icon name="external" size={14} />
          </a>
        </div>
        <div className={styles.badges}>
          <Badge variant="neutral">{focus.kind === 're_review' ? COPY.kind.re_review : COPY.kind.initial}</Badge>
          {othersRunning > 0 && <Badge variant="info">{COPY.moreRunning(othersRunning)}</Badge>}
        </div>
      </div>

      <div className={styles.action}>
        {active ? (
          <>
            <LiveIndicator label={focus.label} ariaLabel="Current review action" />
            {stageFor && <span className="prr-hint">{COPY.forDuration(stageFor)}</span>}
          </>
        ) : (
          <ResultLine focus={focus} />
        )}
        <Link href={`/requests/${focus.id}`} className={`prr-link ${styles.open}`}>
          {COPY.openRequest}
        </Link>
      </div>

      {focus.status !== 'queued' && (
        <div className={styles.progress}>
          <ProgressBar
            value={focus.percent}
            label="Review progress"
            valueText={steps && focus.percent !== null ? COPY.steps(steps.done, steps.total, focus.percent) : COPY.stepsUnknown}
          />
          <span className={styles.nums}>
            {steps && focus.percent !== null ? COPY.steps(steps.done, steps.total, focus.percent) : COPY.stepsUnknown}
          </span>
        </div>
      )}

      {active && (focus.files || focus.chunks) && (
        <ul className={styles.facts}>
          {focus.files && <li>{COPY.files(focus.files)}</li>}
          {focus.chunks && focus.stage === 'reviewing' && <li>{COPY.chunks(focus.chunks)}</li>}
          {focus.chunks?.lastFinishedAt && focus.stage === 'reviewing' && (
            <li>{COPY.lastChunk(since(focus.chunks.lastFinishedAt, now) ?? '0s')}</li>
          )}
          {focus.chunks && focus.chunks.repairs > 0 && <li>{COPY.repairs(focus.chunks.repairs)}</li>}
          {focus.chunks && focus.chunks.unreviewedFiles > 0 && <li>{COPY.unreviewed(focus.chunks.unreviewedFiles)}</li>}
        </ul>
      )}

      {focus.status !== 'queued' && (
        <ol className={styles.stepper} aria-label="Review steps">
          {focus.stepper.map((step) => (
            <li key={step.stage} className={styles.step} data-state={step.state}>
              <span aria-hidden="true">{STEP_GLYPH[step.state]}</span>
              <span>{step.label}</span>
              <span className="prr-sr">({step.state})</span>
            </li>
          ))}
        </ol>
      )}

      {focus.stalled && heartbeatAgo && (
        <div className="prr-attn prr-attn--warning">
          <span className="prr-attn-icon" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <div className="prr-attn-body">
            <p className="prr-hint">{COPY.stalled(heartbeatAgo)}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * The review the bot is working on right now, above the requests table.
 * It follows one review until it finishes, shows the result briefly, then
 * moves to the next running one. It renders nothing when none is running.
 */
export function LiveReview(): React.ReactElement | null {
  const focusRef = React.useRef<string | null>(null);
  const finishedRef = React.useRef<string | null>(null);
  // The finished review whose result window has passed; hidden until the next poll replaces it.
  const [expiredId, setExpiredId] = React.useState<string | null>(null);
  const now = useNow();

  const { data, error, mutate } = useSWR<LiveResponse, FetchError>(
    'live-review',
    () => fetcher<LiveResponse>(`/api/dashboard/requests/live${focusRef.current ? `?focus=${focusRef.current}` : ''}`),
    {
      refreshInterval: (latest) => (latest?.focus ? ACTIVE_POLL_MS : IDLE_POLL_MS),
      onSuccess: (latest) => {
        const focus = latest.focus;
        if (!focus) {
          focusRef.current = null;
          return;
        }
        focusRef.current = focus.id;
        if (isActive(focus.status) || finishedRef.current === focus.id) return;
        // Finished: keep it on screen briefly, then let the next poll pick the next review.
        finishedRef.current = focus.id;
        window.setTimeout(() => {
          if (focusRef.current === focus.id) focusRef.current = null;
          setExpiredId(focus.id);
          void mutate();
        }, RESULT_MS);
      },
    }
  );

  if (error) {
    return (
      <section className={styles.section} aria-labelledby="live-heading">
        <h2 id="live-heading" className="prr-label">
          {COPY.heading}
        </h2>
        <ErrorState title={COPY.loadFailed} message={error.message} onRetry={() => void mutate()} />
      </section>
    );
  }

  const focus = data?.focus;
  // A finished review past its result window is hidden even before the next poll lands.
  if (!focus || (!isActive(focus.status) && expiredId === focus.id)) return null;

  return (
    <section className={styles.section} aria-labelledby="live-heading">
      <h2 id="live-heading" className="prr-label">
        {COPY.heading}
      </h2>
      <FocusCard focus={focus} othersRunning={data.othersRunning} now={now} />
    </section>
  );
}
