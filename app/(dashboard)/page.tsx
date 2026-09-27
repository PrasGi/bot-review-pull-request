'use client';

import * as React from 'react';
import useSWR from 'swr';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { Card } from '@/components/ui/Card';
import { PageHeader, SectionHeading } from '@/components/layout/PageHeader';
import { Grid } from '@/components/layout/Grid';
import { StatCard } from '@/components/dashboard/StatCard';
import { BudgetMeter } from '@/components/dashboard/BudgetMeter';
import { AttentionItem, AttentionList } from '@/components/dashboard/AttentionList';
import { ErrorState } from '@/components/data/States';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { ChartCard } from '@/components/charts/ChartParts';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ChartTone } from '@/components/charts/tones';

type DashboardStats = {
  reviewsToday: number;
  reviewsThisWeek: number;
  costThisMonth: number;
  avgReviewSeconds: number;
  reviewsPerDay: { date: string; completed: number; failed: number }[];
  verdictDistribution: { verdict: string; count: number }[];
  attention: {
    reconnectAccounts: string[];
    refreshExpiringAccounts: { githubLogin: string; expiresAt: string }[];
    staleRepos: string[];
    failedLast24h: number;
  };
  budgetAlert: { thresholdUsd: number; todayUsd: number } | null;
};

// APPROVE → success, REQUEST_CHANGES → error, COMMENT → warning.
const VERDICT_TONES: Record<string, ChartTone> = {
  APPROVE: 'success',
  REQUEST_CHANGES: 'error',
  COMMENT: 'warning',
};

const VERDICT_LABELS: Record<string, string> = {
  APPROVE: 'Approve',
  REQUEST_CHANGES: 'Request changes',
  COMMENT: 'Comment',
};

function formatCost(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

const HEADER = (
  <PageHeader title="Dashboard" description="Review activity across every connected repo." />
);

function ChartSkeleton(): React.ReactElement {
  return <Skeleton style={{ height: 240 }} />;
}

export default function DashboardPage(): React.ReactElement {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>('/api/dashboard/stats', fetcher);

  if (isLoading) {
    return (
      <>
        {HEADER}
        <div role="status" aria-label="Loading dashboard" style={{ display: 'contents' }}>
          <Grid variant="stats">
            <StatCard label="Reviews today" loading />
            <StatCard label="Reviews this week" loading />
            <StatCard label="Cost this month" loading />
            <StatCard label="Avg review time" loading />
          </Grid>
          <Grid variant="pair">
            <ChartCard title="Reviews per day">
              <ChartSkeleton />
            </ChartCard>
            <ChartCard title="Verdict distribution">
              <ChartSkeleton />
            </ChartCard>
          </Grid>
        </div>
      </>
    );
  }

  if (error || !data) {
    const message = error instanceof FetchError ? error.message : 'Failed to load dashboard data';
    return (
      <>
        {HEADER}
        <ErrorState title="Could not load dashboard" message={message} onRetry={() => void mutate()} />
      </>
    );
  }

  const {
    reviewsToday,
    reviewsThisWeek,
    costThisMonth,
    avgReviewSeconds,
    reviewsPerDay,
    verdictDistribution,
    attention,
    budgetAlert,
  } = data;

  const barData = reviewsPerDay.map((d) => ({ label: formatDay(d.date), completed: d.completed, failed: d.failed }));
  const donutData = verdictDistribution.map((v) => ({
    label: VERDICT_LABELS[v.verdict] ?? v.verdict,
    value: v.count,
    tone: VERDICT_TONES[v.verdict] ?? 'neutral',
  }));
  const reviewTotal = verdictDistribution.reduce((sum, v) => sum + v.count, 0);

  return (
    <>
      {HEADER}

      <Grid variant="stats" as="section" aria-label="Summary stats">
        <StatCard label="Reviews today" value={String(reviewsToday)} icon="pr" />
        <StatCard label="Reviews this week" value={String(reviewsThisWeek)} icon="calendar" />
        <StatCard label="Cost this month" value={formatCost(costThisMonth)} icon="dollar" />
        <StatCard label="Avg review time" value={formatSeconds(avgReviewSeconds)} icon="timer" />
      </Grid>

      {budgetAlert && (
        <section aria-label="Daily budget">
          <Card>
            <BudgetMeter
              label="Daily cost budget"
              spent={budgetAlert.todayUsd}
              limit={budgetAlert.thresholdUsd}
              format={formatCost}
            />
          </Card>
        </section>
      )}

      <Grid variant="pair" as="section" aria-label="Charts">
        <ChartCard title="Reviews per day">
          <BarChart
            data={barData}
            series={[
              { key: 'completed', label: 'Completed', tone: 'accent' },
              { key: 'failed', label: 'Failed', tone: 'error', hatch: true },
            ]}
            ariaLabel="Bar chart showing completed and failed reviews per day"
          />
        </ChartCard>
        <ChartCard title="Verdict distribution">
          {donutData.length ? (
            <DonutChart
              data={donutData}
              centerLabel="reviews"
              centerValue={reviewTotal}
              ariaLabel="Donut chart showing review verdict distribution"
            />
          ) : (
            <p className="prr-hint">Verdicts appear here once reviews finish.</p>
          )}
        </ChartCard>
      </Grid>

      <section aria-label="Needs attention">
        <Card>
          <SectionHeading>Needs attention</SectionHeading>
          <AttentionList>
            {attention.reconnectAccounts.length > 0 && (
              <AttentionItem
                tone="warning"
                icon="plug"
                title={`${attention.reconnectAccounts.length} ${plural(attention.reconnectAccounts.length, 'account needs', 'accounts need')} reconnecting`}
                tags={attention.reconnectAccounts}
                action={{ label: 'Manage in Projects', href: '/projects' }}
              />
            )}
            {attention.refreshExpiringAccounts.length > 0 && (
              <AttentionItem
                tone="warning"
                icon="clock"
                title={`${attention.refreshExpiringAccounts.length} GitHub ${plural(attention.refreshExpiringAccounts.length, 'connection', 'connections')} expiring soon`}
                tags={attention.refreshExpiringAccounts.map(
                  (acc) => `${acc.githubLogin} · ${new Date(acc.expiresAt).toLocaleDateString()}`
                )}
                action={{ label: 'Reconnect in Projects', href: '/projects' }}
              />
            )}
            {attention.staleRepos.length > 0 && (
              <AttentionItem
                tone="neutral"
                icon="wifiOff"
                title={`${attention.staleRepos.length} ${plural(attention.staleRepos.length, 'repository has', 'repositories have')} no recent webhook events`}
                tags={attention.staleRepos}
                action={{ label: 'Check webhook config', href: '/projects' }}
              />
            )}
            {attention.failedLast24h > 0 && (
              <AttentionItem
                tone="error"
                icon="alert"
                title={`${attention.failedLast24h} failed ${plural(attention.failedLast24h, 'review', 'reviews')} in the last 24h`}
                action={{ label: 'View failed requests', href: '/requests?status=failed' }}
              />
            )}
          </AttentionList>
        </Card>
      </section>
    </>
  );
}
