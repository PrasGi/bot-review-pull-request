'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Download } from 'lucide-react';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';

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

function UsageSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <GlassCard key={i}>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </GlassCard>
        ))}
      </div>
      <GlassCard>
        <Skeleton className="h-72 w-full" />
      </GlassCard>
      <GlassCard className="p-0">
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </GlassCard>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <GlassCard>
      <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">
        {value}
      </p>
    </GlassCard>
  );
}

type ChartDatum = { name: string; cost: number };

const TOOLTIP_STYLE = {
  background: 'var(--glass-bg-solid)',
  border: '1px solid var(--glass-border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '12px',
} as const;

function tooltipFormatter(
  value: number | string | readonly (string | number)[] | undefined,
): [string, string] {
  return [`$${Number(value ?? 0).toFixed(4)}`, 'Cost'];
}

function yAxisFormatter(value: number | string): string {
  return `$${Number(value).toFixed(2)}`;
}

function UsageChart({
  rows,
  groupBy,
}: {
  rows: UsageRow[];
  groupBy: GroupBy;
}): React.ReactElement {
  const chartData: ChartDatum[] = rows.map((r) => ({ name: r.group, cost: r.costUsd }));
  const labelId = 'usage-chart-title';
  const axisProps = {
    axisLine: false as const,
    tickLine: false as const,
    tick: { fontSize: 12, fill: 'var(--text-muted)' },
  };

  return (
    <GlassCard>
      <h2
        id={labelId}
        className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]"
      >
        Cost by{' '}
        {groupBy === 'day' ? 'Day' : groupBy === 'model' ? 'Model' : 'Repo'}
      </h2>
      <div role="img" aria-labelledby={labelId} className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {groupBy === 'day' ? (
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis
                {...axisProps}
                tickFormatter={yAxisFormatter}
                width={60}
              />
              <RTooltip
                formatter={tooltipFormatter}
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 2' }}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--accent)' }}
              />
            </LineChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis
                {...axisProps}
                tickFormatter={yAxisFormatter}
                width={60}
              />
              <RTooltip
                formatter={tooltipFormatter}
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: 'var(--accent)', opacity: 0.08 }}
              />
              <Bar
                dataKey="cost"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

function UsageTableRow({ row }: { row: UsageRow }): React.ReactElement {
  const errorPct = row.errorRate * 100;
  const isHighError = row.errorRate > 0.1;
  const isModerateError = row.errorRate > 0.05;

  return (
    <tr className="border-t border-[var(--glass-border)] transition-colors hover:bg-[var(--nav-hover)]">
      <td className="px-4 py-3 text-sm text-[var(--text)]">{row.group}</td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-[var(--text)]">
        {fmt(row.calls)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-[var(--text)]">
        {fmt(row.promptTokens)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-[var(--text)]">
        {fmt(row.completionTokens)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-[var(--text)]">
        {fmtCost(row.costUsd)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-[var(--text)]">
        {fmt(Math.round(row.avgLatencyMs))}
      </td>
      <td className="px-4 py-3 text-right">
        {isModerateError ? (
          <Badge variant={isHighError ? 'error' : 'warning'}>
            {errorPct.toFixed(1)}%
          </Badge>
        ) : (
          <span className="tabular-nums text-sm text-[var(--text-muted)]">
            {errorPct.toFixed(1)}%
          </span>
        )}
      </td>
    </tr>
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

  const { data, error, isLoading } = useSWR<UsageSummary, FetchError>(
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

  const errorMessage = error?.message ?? 'Failed to load usage data';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">AI Usage</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Token consumption and cost breakdown
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Group by"
            value={groupBy}
            options={GROUP_OPTIONS}
            onChange={(e) => updateParams({ groupBy: e.target.value as GroupBy })}
          />
          <Select
            label="Period"
            value={String(days)}
            options={DAYS_OPTIONS}
            onChange={(e) => updateParams({ days: parseInt(e.target.value, 10) })}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            aria-label="Export usage data as CSV"
            className="mb-0.5"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading && <UsageSkeleton />}

      {!isLoading && error && (
        <GlassCard>
          <p className="text-sm text-[oklch(0.60_0.20_25)]" role="alert">
            {errorMessage}
          </p>
        </GlassCard>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Cost" value={fmtCost(data.totalCost)} />
            <SummaryCard label="Total Calls" value={fmt(data.totalCalls)} />
            <SummaryCard
              label="Prompt Tokens"
              value={fmt(data.totalPromptTokens)}
            />
            <SummaryCard
              label="Completion Tokens"
              value={fmt(data.totalCompletionTokens)}
            />
          </div>

          {data.rows.length > 0 && (
            <UsageChart rows={data.rows} groupBy={groupBy} />
          )}

          <GlassCard className="overflow-hidden p-0">
            {data.rows.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-[var(--text-muted)]">
                No usage data for this period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[640px]"
                  aria-label="Usage breakdown table"
                >
                  <thead>
                    <tr className="border-b border-[var(--glass-border)]">
                      {[
                        { label: 'Group', align: 'left' },
                        { label: 'Calls', align: 'right' },
                        { label: 'Prompt Tokens', align: 'right' },
                        { label: 'Completion Tokens', align: 'right' },
                        { label: 'Cost ($)', align: 'right' },
                        { label: 'Avg Latency (ms)', align: 'right' },
                        { label: 'Error Rate', align: 'right' },
                      ].map(({ label, align }) => (
                        <th
                          key={label}
                          scope="col"
                          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] text-${align}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <UsageTableRow key={row.group} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}

export default function UsagePage(): React.ReactElement {
  return (
    <React.Suspense fallback={<UsageSkeleton />}>
      <UsageContent />
    </React.Suspense>
  );
}
