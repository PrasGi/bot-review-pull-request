'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { DescriptionList } from '@/components/data/DescriptionList';
import { Disclosure } from '@/components/review/Disclosure';
import { LiveProgressCard, elapsedSince, isActiveStatus } from '@/components/review/LiveProgressCard';
import type { PublicChunkRow, PublicLive } from '@/lib/review/public-live';
import { PUBLIC_LIVE_COPY as COPY } from '@/lib/review/progress-copy';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { useNow } from '@/lib/ui/use-now';
import { InviteState } from '../../invite/InviteState';
import styles from './live.module.css';

const POLL_MS = 2_000;
const INLINE_FILES = 3;

/**
 * Stops polling once the run is over. Defined at module level on purpose: the
 * page re-renders every second for its timers, and SWR restarts its refresh
 * timer whenever this function's identity changes, so an inline arrow would
 * never let a refresh fire.
 */
function pollInterval(latest: PublicLive | undefined): number {
  return latest && !isActiveStatus(latest.status) ? 0 : POLL_MS;
}

function FileList({ files }: { files: string[] }): React.ReactElement {
  return (
    <ul className={styles.files}>
      {files.map((file) => (
        <li key={file}>
          <code>{file}</code>
        </li>
      ))}
    </ul>
  );
}

function ChunkRow({ row, now }: { row: PublicChunkRow; now: number }): React.ReactElement {
  const running = row.state === 'running' ? elapsedSince(row.startedAt, now) : null;
  return (
    <li className={styles.chunk} data-state={row.state}>
      <div className={styles.chunkHead}>
        <span className={styles.chunkName}>{COPY.chunkName(row.number)}</span>
        <span className={styles.chunkState}>
          {COPY.chunkState[row.state]}
          {running && ` · ${running}`}
        </span>
      </div>
      {row.files.length <= INLINE_FILES ? (
        <FileList files={row.files} />
      ) : (
        <Disclosure summary={COPY.filesCount(row.files.length)}>
          <FileList files={row.files} />
        </Disclosure>
      )}
    </li>
  );
}

function LiveSkeleton(): React.ReactElement {
  return (
    <Card role="status" aria-label="Loading the review progress" className={styles.skeleton}>
      <Skeleton style={{ width: 240, height: 16 }} />
      <Skeleton style={{ width: '60%', height: 14 }} />
      <Skeleton style={{ height: 20 }} />
      <Skeleton style={{ width: '80%', height: 12 }} />
    </Card>
  );
}

export function LiveStatus({ token }: { token: string }): React.ReactElement {
  const now = useNow();
  const { data, error } = useSWR<PublicLive, FetchError>(`/api/live/${encodeURIComponent(token)}`, fetcher, {
    refreshInterval: pollInterval,
    shouldRetryOnError: (err) => !(err instanceof FetchError && [404, 410, 422].includes(err.status)),
  });

  if (error instanceof FetchError && (error.status === 404 || error.status === 422)) {
    const s = COPY.notFound;
    return <InviteState badge={s.badge} tone="error" title={s.title} body={s.body} />;
  }
  if (error instanceof FetchError && error.status === 410) {
    const s = COPY.expired;
    return <InviteState badge={s.badge} tone="warning" title={s.title} body={s.body} />;
  }
  if (!data) {
    return (
      <>
        {error && <p className="prr-hint">{COPY.loadFailed}</p>}
        <LiveSkeleton />
      </>
    );
  }

  const details = [
    ...(data.model ? [{ term: COPY.modelLabel, value: `${data.model.providerLabel} · ${data.model.model}`, mono: true }] : []),
    ...(data.character
      ? [{ term: COPY.characterLabel, value: `${data.character.label}. ${data.character.description}` }]
      : []),
  ];

  return (
    <>
      <header className={styles.hero}>
        <span className="prr-brand-mark is-lg" aria-hidden="true">
          <Icon name="pr" size={24} />
        </span>
        <p className="prr-label">{COPY.kicker}</p>
      </header>

      <LiveProgressCard
        data={data}
        now={now}
        footerLink={
          <a href={data.prUrl} target="_blank" rel="noopener noreferrer" className="prr-link">
            {isActiveStatus(data.status) ? COPY.openPr : COPY.viewOnGitHub}
          </a>
        }
      >
        {details.length > 0 && <DescriptionList items={details} />}
      </LiveProgressCard>

      {data.chunkRows.length > 0 && (
        <section aria-labelledby="chunks-heading" className={styles.section}>
          <h2 id="chunks-heading" className="prr-label">
            {COPY.chunksHeading}
          </h2>
          <ol className={styles.chunks}>
            {data.chunkRows.map((row) => (
              <ChunkRow key={row.number} row={row} now={now} />
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
