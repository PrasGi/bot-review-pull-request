import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import styles from './page.module.css';

type ConnectedStatus = 'received' | 'pending';

type ConnectedContent = {
  badge: React.ReactElement;
  title: string;
  body: string;
};

const CONTENT: Record<ConnectedStatus, ConnectedContent> = {
  received: {
    badge: <Badge variant="success">✓ Received</Badge>,
    title: 'Installation received',
    body: 'PR Reviewer is syncing the selected repositories. They will appear in the dashboard shortly — no further action is needed here.',
  },
  pending: {
    badge: <Badge variant="warning">! Pending</Badge>,
    title: 'Approval pending',
    body: 'Your installation request was submitted. An organization owner must approve it before the repositories become available.',
  },
};

function resolveStatus(value: string | undefined): ConnectedStatus {
  return value === 'pending' ? 'pending' : 'received';
}

export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const content = CONTENT[resolveStatus(params.status)];

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className="prr-brand-mark is-lg" aria-hidden="true">
          <Icon name="pr" size={24} />
        </span>
        {content.badge}
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.body}>{content.body}</p>
        <Link href="/login" className="prr-link">
          Go to PR Reviewer →
        </Link>
      </Card>
    </main>
  );
}
