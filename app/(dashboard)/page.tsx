'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  GitPullRequest,
  Calendar,
  DollarSign,
  Timer,
  AlertTriangle,
  CheckCheck,
  PlugZap,
} from 'lucide-react';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

type DashboardStats = {
  reviewsToday: number;
  reviewsThisWeek: number;
  costThisMonth: number;
  avgReviewSeconds: number;
  reviewsPerDay: { date: string; completed: number; failed: number }[];
  verdictDistribution: { verdict: string; count: number }[];
  attention: { reconnectAccounts: string[]; failedLast24h: number };
};

const VERDICT_COLORS: Record<string, string> = {
  APPROVE: 'oklch(0.70 0.15 142)',
  REQUEST_CHANGES: 'oklch(0.60 0.20 25)',
  COMMENT: 'oklch(0.65 0.15 240)',
};

function verdictColor(verdict: string): string {
  return VERDICT_COLORS[verdict] ?? 'oklch(0.62 0.18 250)';
}

function formatCost(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

const TOOLTIP_STYLE = {
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '12px',
  backdropFilter: 'blur(12px)',
} satisfies React.CSSProperties;

function StatCardSkeleton(): React.ReactElement {
  return (
    <GlassCard className="flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-16" />
    </GlassCard>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  icon: React.ReactElement;
};

function StatCard({ label, value, icon }: StatCardProps): React.ReactElement {
  return (
    <GlassCard hoverLift className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-muted)]">{label}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p className="tabular-nums text-3xl font-bold text-[var(--text)]">{value}</p>
    </GlassCard>
  );
}

export default function DashboardPage(): React.ReactElement {
  const { data, error, isLoading } = useSWR<DashboardStats>(
    '/api/dashboard/stats',
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6" role="status" aria-label="Loading dashboard">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard>
            <Skeleton className="mb-4 h-5 w-36" />
            <Skeleton className="h-72 w-full rounded-lg" />
          </GlassCard>
          <GlassCard>
            <Skeleton className="mb-4 h-5 w-44" />
            <Skeleton className="h-72 w-full rounded-lg" />
          </GlassCard>
        </div>
        <GlassCard>
          <Skeleton className="mb-3 h-5 w-36" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </GlassCard>
      </div>
    );
  }

  if (error) {
    const message =
      error instanceof FetchError ? error.message : 'Failed to load dashboard data';
    return (
      <div className="p-6">
        <GlassCard role="alert">
          <div className="flex items-center gap-3">
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-[oklch(0.60_0.20_25)]"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium text-[var(--text)]">Could not load dashboard</p>
              <p className="text-sm text-[var(--text-muted)]">{message}</p>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!data) {
    return <></>;
  }

  const {
    reviewsToday,
    reviewsThisWeek,
    costThisMonth,
    avgReviewSeconds,
    reviewsPerDay,
    verdictDistribution,
    attention,
  } = data;

  const hasAttentionItems =
    attention.reconnectAccounts.length > 0 || attention.failedLast24h > 0;

  return (
    <main className="flex flex-col gap-6 p-6">
      <section aria-label="Summary stats">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Reviews Today"
            value={String(reviewsToday)}
            icon={<GitPullRequest className="h-4 w-4" />}
          />
          <StatCard
            label="Reviews This Week"
            value={String(reviewsThisWeek)}
            icon={<Calendar className="h-4 w-4" />}
          />
          <StatCard
            label="Cost This Month"
            value={formatCost(costThisMonth)}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Avg Review Time"
            value={formatSeconds(avgReviewSeconds)}
            icon={<Timer className="h-4 w-4" />}
          />
        </div>
      </section>

      <section aria-label="Charts">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard>
            <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Reviews per Day</h2>
            <div
              className="h-72"
              role="img"
              aria-label="Bar chart showing completed and failed reviews per day"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reviewsPerDay}
                  margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'var(--accent-subtle)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: '8px' }} />
                  <Bar dataKey="completed" fill="oklch(0.62 0.18 250)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" fill="oklch(0.60 0.20 25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">
              Verdict Distribution
            </h2>
            <div
              className="h-72"
              role="img"
              aria-label="Donut chart showing review verdict distribution"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verdictDistribution}
                    dataKey="count"
                    nameKey="verdict"
                    cx="50%"
                    cy="50%"
                    innerRadius="50%"
                    outerRadius="70%"
                    paddingAngle={3}
                  >
                    {verdictDistribution.map((entry) => (
                      <Cell key={entry.verdict} fill={verdictColor(entry.verdict)} />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      </section>

      <section aria-label="Needs attention">
        <GlassCard>
          <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Needs Attention</h2>
          {hasAttentionItems ? (
            <div className="flex flex-col gap-3">
              {attention.reconnectAccounts.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-[oklch(0.80_0.12_85/0.3)] bg-[oklch(0.80_0.12_85/0.08)] p-4">
                  <PlugZap
                    className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.55_0.14_85)]"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-[var(--text)]">
                      {attention.reconnectAccounts.length}{' '}
                      account{attention.reconnectAccounts.length > 1 ? 's' : ''} need
                      reconnecting
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {attention.reconnectAccounts.map((login) => (
                        <Badge key={login} variant="warning">
                          {login}
                        </Badge>
                      ))}
                    </div>
                    <Link
                      href="/projects"
                      className="text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      Manage in Projects →
                    </Link>
                  </div>
                </div>
              )}
              {attention.failedLast24h > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-[oklch(0.60_0.20_25/0.3)] bg-[oklch(0.60_0.20_25/0.08)] p-4">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.50_0.20_25)]"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-[var(--text)]">
                      {attention.failedLast24h} failed review
                      {attention.failedLast24h > 1 ? 's' : ''} in the last 24h
                    </p>
                    <Link
                      href="/requests?status=failed"
                      className="text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      View failed requests →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1 text-[var(--text-muted)]">
              <CheckCheck
                className="h-5 w-5 text-[oklch(0.70_0.15_142)]"
                aria-hidden="true"
              />
              <span className="text-sm">All clear — no issues to address</span>
            </div>
          )}
        </GlassCard>
      </section>
    </main>
  );
}
