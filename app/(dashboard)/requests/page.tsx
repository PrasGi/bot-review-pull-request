'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, FetchError } from '@/lib/ui/swr';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';


type RequestListItem = {
  id: string;
  prNumber: number;
  prTitle: string;
  repoFullName: string;
  status: string;
  kind: string;
  trigger: string;
  createdAt: string;
  finishedAt?: string;
  verdict?: string;
  costUsd: number;
};

type RequestListResult = {
  items: RequestListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type StatusVariant = 'success' | 'error' | 'info' | 'neutral';
type VerdictVariant = 'success' | 'error' | 'neutral';

function statusVariant(status: string): StatusVariant {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'processing' || status === 'queued') return 'info';
  return 'neutral';
}

function verdictVariant(verdict: string): VerdictVariant {
  if (verdict === 'APPROVE') return 'success';
  if (verdict === 'REQUEST_CHANGES') return 'error';
  return 'neutral';
}

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

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'skipped_draft', label: 'Skipped (Draft)' },
  { value: 'superseded', label: 'Superseded' },
];

const PAGE_SIZE = 20;
const SKELETON_KEYS = ['sk-a', 'sk-b', 'sk-c', 'sk-d', 'sk-e', 'sk-f'] as const;

function SkeletonRows(): React.ReactElement {
  return (
    <>
      {SKELETON_KEYS.map((key) => (
        <tr key={key}>
          <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
          <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
        </tr>
      ))}
    </>
  );
}

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

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>): void {
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
    fetcher
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-[var(--text)]">Review Requests</h1>
        <p className="text-sm text-[var(--text-muted)]">
          All PR review requests across your repositories
        </p>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="flex flex-wrap gap-3 items-end p-4 border-b border-[var(--glass-border)]">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={handleStatusChange}
            containerClassName="min-w-[160px]"
          />
          <Input
            key={search}
            label="Search"
            type="search"
            placeholder="PR title, author, number…"
            defaultValue={search}
            onChange={handleSearchChange}
            containerClassName="flex-1 min-w-[200px]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)] bg-[var(--nav-hover)]">
                <th scope="col" className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Pull Request
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Repository
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Verdict
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-[var(--text-muted)] tabular-nums">
                  Cost
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {isLoading ? (
                <SkeletonRows />
              ) : error ? null : data && data.items.length === 0 ? null : (
                data?.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--nav-hover)] transition-colors"
                  >
                    <td className="px-4 py-3 max-w-xs">
                      <Link
                        href={`/requests/${item.id}`}
                        className="block hover:text-[var(--accent)] transition-colors"
                      >
                        <span className="font-medium text-[var(--text)] truncate block">
                          #{item.prNumber}{' '}
                          <span className="truncate">{item.prTitle}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] truncate max-w-[180px]">
                      {item.repoFullName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(item.status)}>
                        {item.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {item.verdict ? (
                        <Badge variant={verdictVariant(item.verdict)}>
                          {item.verdict.replace(/_/g, ' ')}
                        </Badge>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)]">
                      {formatCost(item.costUsd)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!isLoading && error && (
            <div className="p-6 text-center">
              <p className="text-sm text-[oklch(0.60_0.20_25)]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && data && data.items.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center gap-3">
              <p className="text-[var(--text-muted)] text-sm font-medium">No review requests found</p>
              <p className="text-[var(--text-muted)] text-xs">
                {status || search
                  ? 'Try adjusting your filters'
                  : 'Review requests will appear here once they are created'}
              </p>
            </div>
          )}
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--glass-border)]">
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              Page {page} of {totalPages} &middot; {data.total} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
