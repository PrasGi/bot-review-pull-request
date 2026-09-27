'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { LiveIndicator } from '@/components/layout/Status';
import { ErrorState } from '@/components/data/States';
import { ProgressBar } from '@/components/data/ProgressBar';
import type { LiveOther, LiveRequest, LiveResponse } from '@/lib/dashboard/live';
import { formatElapsed } from '@/lib/review/progress';
import { LIVE_COPY as COPY } from '@/lib/review/progress-copy';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { verdictTone, type Tone } from '@/lib/ui/tones';
import styles from './LiveReview.module.css';

const RESULT_MS = 60_000;
const POLL_MS = 2_000;
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

/** The result line of a finished review, and the tone of its badge. */
function resultOf(focus: LiveRequest): { text: string; tone: Tone } {
  const duration =
    focus.startedAt && focus.finishedAt
      ? formatElapsed(new Date(focus.finishedAt).getTime() - new Date(focus.startedAt).getTime())
      : '—';
  if (focus.status === 'completed') {
    return focus.result
      ? {
          text: COPY.result.completed(focus.result.verdict, focus.result.findings, duration),
          tone: verdictTone(focus.result.verdict),
        }
      : { text: COPY.result.completedNoReview(duration), tone: 'success' };
  }
  if (focus.status === 'failed') return { text: COPY.result.failed(focus.error ?? 'unknown error'), tone: 'error' };
  return { text: COPY.result.cancelled(focus.cancelReason ?? focus.status.replace(/_/g, ' ')), tone: 'neutral' };
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

function OtherReviews({ others, onFollow }: { others: LiveOther[]; onFollow: (id: string) => void }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  return (
    <div className={styles.others}>
      <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        {COPY.moreRunning(others.length)}
        <Icon name="chevronDown" size={14} />
      </Button>
      {open && (
        <ul id={listId} className={styles.otherList} aria-label={COPY.switchTo}>
          {others.map((other) => (
            <li key={other.id}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  onFollow(other.id);
                }}
              >
                <code>
                  {other.repoFullName}#{other.prNumber}
                </code>
                <span className="prr-hint">{other.label}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type FocusCardProps = {
  focus: LiveRequest;
  others: LiveOther[];
  now: number;
  onFollow: (id: string) => void;
};

function FocusCard({ focus, others, now, onFollow }: FocusCardProps): React.ReactElement {
  const active = isActive(focus.status);
  const result = active ? null : resultOf(focus);
  const chunks = focus.chunks;
  const inReview = active && focus.stage === 'reviewing';
  const settled = chunks ? (focus.percent === 100 ? chunks.total : chunks.done + chunks.failed) : 0;
  const oldestFor = focus.oldestChunk ? since(focus.oldestChunk.startedAt, now) : null;
  const heartbeatAgo = since(focus.heartbeatAt, now);

  return (
    <Card className={styles.card}>
      {/* Only stage changes and the result are announced; timers and counters are not. */}
      <p className="prr-sr" aria-live="polite">
        {result ? result.text : focus.label}
      </p>

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
          {others.length > 0 && <OtherReviews others={others} onFollow={onFollow} />}
        </div>
      </div>

      <div className={styles.action}>
        {result ? (
          <Badge variant={result.tone}>{result.text}</Badge>
        ) : (
          <>
            <LiveIndicator label={focus.label} ariaLabel="Current review action" />
            {focus.stageStartedAt && (
              <span className="prr-hint">{COPY.forDuration(since(focus.stageStartedAt, now) ?? '0s')}</span>
            )}
          </>
        )}
        <Link href={`/requests/${focus.id}`} className={`prr-link ${styles.open}`}>
          {COPY.openRequest}
        </Link>
      </div>

      {chunks && focus.percent !== null && (
        <div className={styles.progress}>
          <ProgressBar
            value={focus.percent}
            label="Chunk review progress"
            valueText={COPY.chunkBar(settled, chunks.total, focus.percent)}
          />
          <span className={styles.nums}>{COPY.chunkBar(settled, chunks.total, focus.percent)}</span>
        </div>
      )}

      {active && (focus.files || chunks) && (
        <ul className={styles.facts}>
          {focus.files && <li>{COPY.files(focus.files)}</li>}
          {chunks && inReview && <li>{COPY.chunks(chunks)}</li>}
          {inReview && focus.oldestChunk && oldestFor && (
            <li>{COPY.oldestChunk(focus.oldestChunk.number, oldestFor)}</li>
          )}
          {chunks?.lastFinishedAt && inReview && <li>{COPY.lastChunk(since(chunks.lastFinishedAt, now) ?? '0s')}</li>}
          {chunks && chunks.repairs > 0 && <li>{COPY.repairs(chunks.repairs)}</li>}
          {chunks && chunks.unreviewedFiles > 0 && <li>{COPY.unreviewed(chunks.unreviewedFiles)}</li>}
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

      {inReview && focus.slowChunk && focus.oldestChunk && oldestFor && (
        <Warning>{COPY.slowChunk(focus.oldestChunk.number, oldestFor)}</Warning>
      )}
      {focus.stalled && heartbeatAgo && <Warning>{COPY.stalled(heartbeatAgo)}</Warning>}
    </Card>
  );
}

/**
 * The review the bot is working on right now, above the requests table.
 * It follows one review until it finishes, shows the result for a minute, then
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
      refreshInterval: POLL_MS,
      onSuccess: (latest) => {
        const focus = latest.focus;
        if (!focus) {
          focusRef.current = null;
          return;
        }
        focusRef.current = focus.id;
        if (isActive(focus.status) || finishedRef.current === focus.id) return;
        // Finished: keep it on screen for a minute, then let the next poll pick the next review.
        finishedRef.current = focus.id;
        window.setTimeout(() => {
          if (focusRef.current === focus.id) focusRef.current = null;
          setExpiredId(focus.id);
          void mutate();
        }, RESULT_MS);
      },
    }
  );

  const follow = React.useCallback(
    (id: string): void => {
      focusRef.current = id;
      void mutate();
    },
    [mutate]
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
      <FocusCard focus={focus} others={data.others} now={now} onFollow={follow} />
    </section>
  );
}
