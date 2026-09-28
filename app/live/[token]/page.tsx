import * as React from 'react';
import type { Metadata } from 'next';
import { PUBLIC_LIVE_COPY as COPY } from '@/lib/review/progress-copy';
import { LiveStatus } from './LiveStatus';
import styles from './live.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: COPY.metaTitle,
  robots: { index: false, follow: false },
};

/** Public: opened from the PR comment by people without a dashboard login. */
export default async function LivePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token } = await params;
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <LiveStatus token={token} />
      </div>
    </main>
  );
}
