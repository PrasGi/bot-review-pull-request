import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, GitPullRequest } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

type ConnectedStatus = 'received' | 'pending';

type ConnectedContent = {
  icon: React.ReactElement;
  title: string;
  body: string;
};

const CONTENT: Record<ConnectedStatus, ConnectedContent> = {
  received: {
    icon: (
      <CheckCircle2
        className="h-6 w-6 text-[oklch(0.70_0.15_142)]"
        aria-hidden="true"
      />
    ),
    title: 'Installation received',
    body: 'PR Reviewer is syncing the selected repositories. They will appear in the dashboard shortly — no further action is needed here.',
  },
  pending: {
    icon: (
      <Clock
        className="h-6 w-6 text-[oklch(0.55_0.14_85)]"
        aria-hidden="true"
      />
    ),
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
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <GlassCard className="w-full max-w-md">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)]">
            <GitPullRequest
              className="h-6 w-6 text-[var(--accent-fg)]"
              aria-hidden="true"
            />
          </div>
          <div className="flex items-center gap-2">
            {content.icon}
            <h1 className="text-lg font-semibold text-[var(--text)]">
              {content.title}
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">{content.body}</p>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Go to PR Reviewer →
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
