'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Select, type SelectChangeEvent } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Tooltip } from '@/components/ui/Tooltip';
import { PageHeader } from '@/components/layout/PageHeader';
import { LiveIndicator } from '@/components/layout/Status';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { requestStatusTone, verdictTone } from '@/lib/ui/tones';
import styles from './page.module.css';

type RequestListItem = {
  id: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prUrl: string;
  repoFullName: string;
  status: string;
  kind: string;
  trigger: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  verdict?: string;
  costUsd: number;
};

type RequestListResult = {
  items: RequestListItem[];
  total: number;
  page: number;
  pageSize: number;
};

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (remSecs === 0) return `${mins}m`;
  return `${mins}m ${remSecs}s`;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'skipped_draft', label: 'Skipped (draft)' },
  { value: 'superseded', label: 'Superseded' },
];

const PAGE_SIZE = 20;

function isInFlight(status: string): boolean {
  return status === 'processing' || status === 'queued';
}

const COLUMNS: Column<RequestListItem>[] = [
  {
    key: 'pr',
    header: 'Pull request',
    render: (item) => (
      <div className={styles.prCell}>
        <div className={styles.prTitleRow}>
          <Link href={`/requests/${item.id}`} className={`prr-cell-title ${styles.prTitle}`}>
            #{item.prNumber} {item.prTitle}
          </Link>
          <a
            href={item.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open PR #${item.prNumber} on GitHub (opens in new tab)`}
            className={styles.external}
          >
            <Icon name="external" size={14} />
          </a>
        </div>
        <div className="prr-cell-sub">
          <code className={styles.repo}>{item.repoFullName}</code>
          <span aria-hidden="true">·</span>
          <span>@{item.prAuthor}</span>
          <span aria-hidden="true">·</span>
          <Badge variant="neutral">{item.kind.replace(/_/g, ' ')}</Badge>
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (item) => (
      <Badge
        variant={requestStatusTone(item.status)}
        className={isInFlight(item.status) ? 'is-live' : undefined}
      >
        {item.status.replace(/_/g, ' ')}
      </Badge>
    ),
  },
  {
    key: 'verdict',
    header: 'Verdict',
    render: (item) =>
      item.verdict ? (
        <Badge variant={verdictTone(item.verdict)}>{item.verdict}</Badge>
      ) : (
        <span className="prr-hint">—</span>
      ),
  },
  {
    key: 'duration',
    header: 'Duration',
    mono: true,
    muted: true,
    render: (item) =>
      item.durationMs !== undefined ? (
        <Tooltip
          content={
            item.finishedAt
              ? `${formatDateAbsolute(item.createdAt)} → ${formatDateAbsolute(item.finishedAt)}`
              : formatDateAbsolute(item.createdAt)
          }
        >
          <span tabIndex={0}>{formatDuration(item.durationMs)}</span>
        </Tooltip>
      ) : isInFlight(item.status) ? (
        'running…'
      ) : (
        '—'
      ),
  },
  {
    key: 'cost',
    header: 'Cost',
    align: 'right',
    mono: true,
    render: (item) => formatCost(item.costUsd),
  },
  {
    key: 'created',
    header: 'Created',
    muted: true,
    render: (item) => (
      <Tooltip content={formatDateAbsolute(item.createdAt)}>
        <time dateTime={item.createdAt} tabIndex={0}>
          {formatDate(item.createdAt)}
        </time>
      </Tooltip>
    ),
  },
];

export default function RequestsPage(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(updates: Record<string, string>): void {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ search: val });
    }, 300);
  }

  function handleStatusChange(e: SelectChangeEvent): void {
    pushParams({ status: e.target.value });
  }

  function goToPage(next: number): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  const apiUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    return `/api/dashboard/requests?${params.toString()}`;
  }, [page, status, search]);

  const { data, error, isLoading } = useSWR<RequestListResult, FetchError>(
    apiUrl,
    fetcher,
    { refreshInterval: 5000, keepPreviousData: true }
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Review requests"
        description="All PR review requests across your repositories."
        actions={<LiveIndicator ariaLabel="Auto-refreshing every 5 seconds" />}
      />

      <DataTable
        caption="Review requests"
        columns={COLUMNS}
        rows={data?.items ?? []}
        rowKey={(item) => item.id}
        loading={isLoading}
        skeletonRows={6}
        error={!isLoading && error ? error.message : undefined}
        empty={{
          title: 'No review requests found',
          description:
            status || search
              ? 'Try adjusting your filters.'
              : 'Review requests appear here once a pull request is opened on a connected repo.',
        }}
        toolbar={
          <>
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={handleStatusChange}
              containerClassName={styles.statusField}
            />
            <Input
              key={search}
              label="Search"
              type="search"
              placeholder="PR title, author, number…"
              defaultValue={search}
              onChange={handleSearchChange}
              containerClassName={styles.searchField}
            />
          </>
        }
        footer={
          data && data.total > 0 ? (
            <Pagination page={page} totalPages={totalPages} total={data.total} onPageChange={goToPage} />
          ) : undefined
        }
      />
    </>
  );
}
