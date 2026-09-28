'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/data/States';
import { LiveProgressCard, isActiveStatus } from '@/components/review/LiveProgressCard';
import type { LiveOther, LiveResponse } from '@/lib/dashboard/live';
import { LIVE_COPY as COPY } from '@/lib/review/progress-copy';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { useNow } from '@/lib/ui/use-now';
import styles from './LiveReview.module.css';

const RESULT_MS = 60_000;
const POLL_MS = 2_000;
const isActive = isActiveStatus;

function OtherReviews({ others, onFollow }: { others: LiveOther[]; onFollow: (id: string) => void }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  return (
    <div className={styles.others}>
      <Button variant="secondary" size="sm" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        <Icon name="refresh" size={14} />
        {COPY.switchButton(others.length)}
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
      <LiveProgressCard
        data={focus}
        now={now}
        headerActions={data.others.length > 0 ? <OtherReviews others={data.others} onFollow={follow} /> : null}
        footerLink={
          <Link href={`/requests/${focus.id}`} className="prr-link">
            {COPY.openRequest}
          </Link>
        }
      />
    </section>
  );
}
