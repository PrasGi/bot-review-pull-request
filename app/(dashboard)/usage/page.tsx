'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Grid } from '@/components/layout/Grid';
import { SummaryCard } from '@/components/dashboard/StatCard';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ErrorState } from '@/components/data/States';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { ChartCard } from '@/components/charts/ChartParts';

type GroupBy = 'model' | 'repo' | 'day';

type UsageRow = {
  group: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  errorRate: number;
};

type UsageSummary = {
  totalCost: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCalls: number;
  rows: UsageRow[];
};

const GROUP_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'model', label: 'Model' },
  { value: 'repo', label: 'Repo' },
] satisfies SelectOption[];

const DAYS_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
] satisfies SelectOption[];

const VALID_GROUP_BY = new Set<GroupBy>(['model', 'repo', 'day']);
const VALID_DAYS = new Set([7, 14, 30, 60, 90]);

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function isGroupBy(value: string | null): value is GroupBy {
  return value !== null && VALID_GROUP_BY.has(value as GroupBy);
}

const GROUP_LABEL: Record<GroupBy, string> = { day: 'day', model: 'model', repo: 'repo' };

function ErrorRate({ rate }: { rate: number }): React.ReactElement {
  const pct = `${(rate * 100).toFixed(1)}%`;
  if (rate > 0.1) return <Badge variant="error">✕ {pct}</Badge>;
  if (rate > 0.05) return <Badge variant="warning">! {pct}</Badge>;
  return <>{pct}</>;
}

const COLUMNS: Column<UsageRow>[] = [
  { key: 'group', header: 'Group', render: (r) => <code>{r.group}</code> },
  { key: 'calls', header: 'Calls', align: 'right', mono: true, render: (r) => fmt(r.calls) },
  { key: 'promptTokens', header: 'Prompt tokens', align: 'right', mono: true, render: (r) => fmt(r.promptTokens) },
  {
    key: 'completionTokens',
    header: 'Completion tokens',
    align: 'right',
    mono: true,
    render: (r) => fmt(r.completionTokens),
  },
  { key: 'cost', header: 'Cost', align: 'right', mono: true, render: (r) => fmtCost(r.costUsd) },
  {
    key: 'latency',
    header: 'Avg latency (ms)',
    align: 'right',
    mono: true,
    render: (r) => fmt(Math.round(r.avgLatencyMs)),
  },
  { key: 'errorRate', header: 'Error rate', align: 'right', mono: true, render: (r) => <ErrorRate rate={r.errorRate} /> },
];

function UsageChart({ rows, groupBy }: { rows: UsageRow[]; groupBy: GroupBy }): React.ReactElement {
  const title = `Cost by ${GROUP_LABEL[groupBy]}`;
  return (
    <ChartCard title={title}>
      {groupBy === 'day' ? (
        <LineChart
          data={rows.map((r) => ({ label: r.group, value: r.costUsd }))}
          format={fmtCost}
          seriesLabel="Cost"
          ariaLabel={`Line chart: ${title}`}
        />
      ) : (
        <BarChart
          data={rows.map((r) => ({ label: r.group, cost: r.costUsd }))}
          series={[{ key: 'cost', label: 'Cost', tone: 'accent' }]}
          format={fmtCost}
          legend={false}
          ariaLabel={`Bar chart: ${title}`}
        />
      )}
    </ChartCard>
  );
}

function SummarySkeleton(): React.ReactElement {
  return (
    <Grid variant="stats">
      <SummaryCard label="Total cost" loading />
      <SummaryCard label="Total calls" loading />
      <SummaryCard label="Prompt tokens" loading />
      <SummaryCard label="Completion tokens" loading />
    </Grid>
  );
}

const HEADER_TEXT = { title: 'AI usage', description: 'Token consumption and cost breakdown.' };

function UsageSkeleton(): React.ReactElement {
  return (
    <>
      <PageHeader {...HEADER_TEXT} />
      <SummarySkeleton />
      <ChartCard title="Cost">
        <Skeleton style={{ height: 240 }} />
      </ChartCard>
    </>
  );
}

function UsageContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawDays = searchParams.get('days');
  const rawGroupBy = searchParams.get('groupBy');

  const parsedDays = rawDays !== null ? parseInt(rawDays, 10) : NaN;
  const days = !isNaN(parsedDays) && VALID_DAYS.has(parsedDays) ? parsedDays : 30;
  const groupBy: GroupBy = isGroupBy(rawGroupBy) ? rawGroupBy : 'day';

  const apiUrl = `/api/dashboard/usage?days=${days}&groupBy=${groupBy}`;

  const { data, error, isLoading, mutate } = useSWR<UsageSummary, FetchError>(
    apiUrl,
    fetcher,
  );

  function updateParams(updates: Partial<{ days: number; groupBy: GroupBy }>): void {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.days !== undefined) params.set('days', String(updates.days));
    if (updates.groupBy !== undefined) params.set('groupBy', updates.groupBy);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleExportCsv(): void {
    const csvUrl = `/api/dashboard/usage?days=${days}&groupBy=${groupBy}&format=csv`;
    const anchor = document.createElement('a');
    anchor.href = csvUrl;
    anchor.download = `usage-${groupBy}-${days}d.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  return (
    <>
      <PageHeader
        {...HEADER_TEXT}
        actions={
          <>
            <Select
              label="Group by"
              value={groupBy}
              options={GROUP_OPTIONS}
              onChange={(e) => updateParams({ groupBy: e.target.value as GroupBy })}
              containerClassName="prr-w160"
            />
            <Select
              label="Period"
              value={String(days)}
              options={DAYS_OPTIONS}
              onChange={(e) => updateParams({ days: parseInt(e.target.value, 10) })}
              containerClassName="prr-w160"
            />
            <Button variant="secondary" onClick={handleExportCsv} aria-label="Export usage data as CSV">
              <Icon name="download" />
              Export CSV
            </Button>
          </>
        }
      />

      {isLoading && <SummarySkeleton />}

      {!isLoading && error && (
        <ErrorState title="Could not load usage" message={error.message || 'Failed to load usage data'} onRetry={() => void mutate()} />
      )}

      {data && (
        <>
          <Grid variant="stats">
            <SummaryCard label="Total cost" value={fmtCost(data.totalCost)} />
            <SummaryCard label="Total calls" value={fmt(data.totalCalls)} />
            <SummaryCard label="Prompt tokens" value={fmt(data.totalPromptTokens)} />
            <SummaryCard label="Completion tokens" value={fmt(data.totalCompletionTokens)} />
          </Grid>

          {data.rows.length > 0 && <UsageChart rows={data.rows} groupBy={groupBy} />}
        </>
      )}

      {!error && (
        <DataTable
          caption="Usage breakdown"
          columns={COLUMNS}
          rows={data?.rows ?? []}
          rowKey={(r) => r.group}
          loading={isLoading}
          empty={{ title: 'No usage data for this period', description: 'AI calls made by reviews show up here.' }}
        />
      )}
    </>
  );
}

export default function UsagePage(): React.ReactElement {
  return (
    <React.Suspense fallback={<UsageSkeleton />}>
      <UsageContent />
    </React.Suspense>
  );
}
