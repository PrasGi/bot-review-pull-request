'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { FolderGit2, GitFork, Building2, User, AlertTriangle, Plus, Link2, Search, Clock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { fetcher, mutateJson, FetchError } from '@/lib/ui/swr';
import { RepoConfigDialog } from './RepoConfigDialog';
import type { RepoConfig } from './RepoConfigDialog';

type Installation = {
  installationId: number;
  accountType: 'User' | 'Organization';
  accountLogin: string;
  manageUrl: string;
};

type Account = {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  reconnectRequired: boolean;
  refreshTokenExpiresAt: string;
  installations: Installation[];
  repoCount: number;
};

type PendingInstallation = {
  accountLogin: string;
  accountType: 'User' | 'Organization';
  requesterLogin: string;
  requestedAt: string;
};

type AccountsResponse = {
  accounts: Account[];
  pendingInstallations: PendingInstallation[];
  connectUrl: string;
};

type Repo = {
  id: string;
  fullName: string;
  accountLogin: string;
  enabled: boolean;
  removedFromInstallation: boolean;
  config: RepoConfig;
  lastEventAt?: string;
};

type ReposResponse = {
  repos: Repo[];
};

function AccountAvatar({ account }: { account: Account }): React.ReactElement {
  const initial = (
    (account.displayName ?? '').charAt(0) ||
    (account.githubLogin ?? '').charAt(0) ||
    '?'
  ).toUpperCase();

  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt={account.displayName}
        width={40}
        height={40}
        className="h-10 w-10 rounded-full object-cover ring-2 ring-[var(--glass-border)] shrink-0"
      />
    );
  }

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold select-none"
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function AccountCard({ account }: { account: Account }): React.ReactElement {
  return (
    <GlassCard hoverLift className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <AccountAvatar account={account} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text)] truncate">
              {account.displayName}
            </span>
            {account.reconnectRequired && (
              <Badge variant="warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Reconnect required
              </Badge>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)]">@{account.githubLogin}</p>
        </div>
        <span className="text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
          {account.repoCount} {account.repoCount === 1 ? 'repo' : 'repos'}
        </span>
      </div>

      {account.installations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {account.installations.map((inst) => (
            <a
              key={inst.installationId}
              href={inst.manageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 glass-btn px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors rounded-[var(--radius-btn)]"
            >
              {inst.accountType === 'Organization' ? (
                <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <User className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
              {inst.accountLogin}
            </a>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function AccountsSkeleton(): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <GlassCard key={i}>
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function AccountsSection(): React.ReactElement {
  const { data, error, isLoading } = useSWR<AccountsResponse>(
    '/api/dashboard/accounts',
    fetcher
  );
  const searchParams = useSearchParams();
  const connectStatus = searchParams.get('connect');
  const notifiedRef = React.useRef(false);

  React.useEffect(() => {
    if (notifiedRef.current) return;
    if (connectStatus === 'pending') {
      notifiedRef.current = true;
      toast.info(
        'Installation pending approval',
        'An organization owner must approve the GitHub App before its repositories appear here.'
      );
    } else if (connectStatus === 'success') {
      notifiedRef.current = true;
      toast.success('GitHub account connected');
    } else if (connectStatus === 'error') {
      notifiedRef.current = true;
      toast.error('Could not connect GitHub account', 'Please try again.');
    }
  }, [connectStatus]);

  return (
    <section aria-labelledby="accounts-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="accounts-heading"
          className="text-lg font-semibold text-[var(--text)]"
        >
          Connected Accounts
        </h2>
        {data?.connectUrl && (
          <Button asChild variant="secondary" size="sm">
            <a href={data.connectUrl}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Connect GitHub account
            </a>
          </Button>
        )}
      </div>

      {isLoading && <AccountsSkeleton />}

      {error instanceof Error && (
        <GlassCard>
          <p className="text-sm text-[oklch(0.60_0.20_25)]" role="alert">
            {error instanceof FetchError ? error.message : 'Failed to load accounts'}
          </p>
        </GlassCard>
      )}

      {data && data.accounts.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-subtle)]">
            <FolderGit2 className="h-6 w-6 text-[var(--accent)]" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">No accounts connected yet</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Connect a GitHub account to start reviewing pull requests.
            </p>
          </div>
          <Button asChild>
            <a href={data.connectUrl}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Connect GitHub account
            </a>
          </Button>
        </GlassCard>
      )}

      {data && data.accounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      {data && data.pendingInstallations.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            Pending owner approval
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.pendingInstallations.map((p) => (
              <div
                key={p.accountLogin}
                className="flex items-start gap-3 rounded-xl border border-[oklch(0.80_0.12_85/0.3)] bg-[oklch(0.80_0.12_85/0.08)] p-4"
              >
                <Clock
                  className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.55_0.14_85)]"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--text)] truncate">
                      {p.accountLogin}
                    </span>
                    <Badge variant="warning">Awaiting approval</Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Requested by @{p.requesterLogin} ·{' '}
                    {new Date(p.requestedAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    An owner of {p.accountLogin} must approve the GitHub App
                    installation. It appears here automatically once approved.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

type RepoRowProps = {
  repo: Repo;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onConfigSaved: () => void;
};

function RepoRow({ repo, onToggle, onConfigSaved }: RepoRowProps): React.ReactElement {
  const [toggling, setToggling] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);

  const handleToggle = async (checked: boolean): Promise<void> => {
    setToggling(true);
    try {
      await onToggle(repo.id, checked);
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 py-3 border-b border-[var(--glass-border)] last:border-0">
        <GitFork
          className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text)] truncate">
            {repo.fullName}
          </span>
          {repo.removedFromInstallation && (
            <Badge variant="neutral" className="shrink-0">
              Removed
            </Badge>
          )}
        </div>
        {repo.lastEventAt && (
          <time
            dateTime={repo.lastEventAt}
            className="text-xs text-[var(--text-muted)] shrink-0 hidden sm:block tabular-nums"
          >
            {new Date(repo.lastEventAt).toLocaleDateString()}
          </time>
        )}
        <Switch
          checked={repo.enabled}
          onCheckedChange={handleToggle}
          disabled={repo.removedFromInstallation || toggling}
          aria-label={`${repo.enabled ? 'Disable' : 'Enable'} ${repo.fullName}`}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfigOpen(true)}
          disabled={repo.removedFromInstallation}
          aria-label={`Configure ${repo.fullName}`}
        >
          Configure
        </Button>
      </div>

      <RepoConfigDialog
        repoId={repo.id}
        repoFullName={repo.fullName}
        config={repo.config}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSaved={onConfigSaved}
      />
    </>
  );
}

type RepoGroupProps = {
  accountLogin: string;
  repos: Repo[];
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onConfigSaved: () => void;
};

function RepoGroup({
  accountLogin,
  repos,
  onToggle,
  onConfigSaved,
}: RepoGroupProps): React.ReactElement {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--glass-border)] flex items-center gap-2 bg-[var(--nav-hover)]">
        <FolderGit2 className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
        <span className="text-sm font-semibold text-[var(--text-muted)]">
          {accountLogin}
        </span>
        <Badge variant="neutral">{repos.length}</Badge>
      </div>
      <div className="px-5">
        {repos.map((repo) => (
          <RepoRow
            key={repo.id}
            repo={repo}
            onToggle={onToggle}
            onConfigSaved={onConfigSaved}
          />
        ))}
      </div>
    </div>
  );
}

const PAGE_SIZE = 15;

function ReposSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <GlassCard key={i} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex items-center gap-3 py-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-[var(--radius-btn)]" />
            </div>
          ))}
        </GlassCard>
      ))}
    </div>
  );
}

function ReposSection(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const rawPage = parseInt(searchParams.get('page') ?? '1', 10);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, error, isLoading, mutate } = useSWR<ReposResponse>(
    '/api/dashboard/repos',
    fetcher
  );

  const handleToggle = async (id: string, enabled: boolean): Promise<void> => {
    try {
      await mutateJson(`/api/dashboard/repos/${id}`, 'PATCH', { enabled });
      toast.success(enabled ? 'Repository enabled' : 'Repository disabled');
      await mutate();
    } catch (e) {
      const message =
        e instanceof FetchError ? e.message : 'Failed to update repository';
      toast.error('Update failed', message);
    }
  };

  const handleConfigSaved = (): void => {
    void mutate();
  };

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
      pushParams({ q: val });
    }, 300);
  }

  function goToPage(next: number): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  const filteredRepos = React.useMemo<Repo[]>(() => {
    if (!data) return [];
    if (!q) return data.repos;
    const lower = q.toLowerCase();
    return data.repos.filter((r) => r.fullName.toLowerCase().includes(lower));
  }, [data, q]);

  const totalFiltered = filteredRepos.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isNaN(rawPage) ? 1 : rawPage, 1), totalPages);

  const grouped = React.useMemo<[string, Repo[]][]>(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, filteredRepos.length);
    const slice = filteredRepos.slice(start, end);
    const map = new Map<string, Repo[]>();
    for (const repo of slice) {
      const list = map.get(repo.accountLogin) ?? [];
      list.push(repo);
      map.set(repo.accountLogin, list);
    }
    return Array.from(map.entries());
  }, [filteredRepos, page]);

  const showingFrom = totalFiltered === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, totalFiltered);

  return (
    <section aria-labelledby="repos-heading">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="repos-heading" className="text-lg font-semibold text-[var(--text)]">
            Repositories
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Manage per-repository review configuration.
          </p>
        </div>
        {data && data.repos.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none"
              aria-hidden="true"
            />
            <Input
              key={q}
              id="repo-search"
              type="search"
              placeholder="Search repositories…"
              defaultValue={q}
              onChange={handleSearchChange}
              className="pl-9"
              aria-label="Search repositories"
            />
          </div>
        )}
      </div>

      {isLoading && <ReposSkeleton />}

      {error instanceof Error && (
        <GlassCard>
          <p className="text-sm text-[oklch(0.60_0.20_25)]" role="alert">
            {error instanceof FetchError
              ? error.message
              : 'Failed to load repositories'}
          </p>
        </GlassCard>
      )}

      {data && data.repos.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-subtle)]">
            <GitFork className="h-6 w-6 text-[var(--accent)]" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">No repositories yet</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Connect an account and install the GitHub app to see repositories here.
            </p>
          </div>
        </GlassCard>
      )}

      {data && data.repos.length > 0 && filteredRepos.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-subtle)]">
            <Search className="h-6 w-6 text-[var(--accent)]" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">No repositories match</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Try a different search term.
            </p>
          </div>
        </GlassCard>
      )}

      {data && filteredRepos.length > 0 && (
        <>
          <div className="flex flex-col gap-4">
            {grouped.map(([accountLogin, repos]) => (
              <RepoGroup
                key={accountLogin}
                accountLogin={accountLogin}
                repos={repos}
                onToggle={handleToggle}
                onConfigSaved={handleConfigSaved}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              Showing {showingFrom}–{showingTo} of {totalFiltered}{' '}
              {totalFiltered === 1 ? 'repository' : 'repositories'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function ProjectsPage(): React.ReactElement {
  return (
    <div className="flex flex-col gap-10 px-4 py-8 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Projects</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage connected GitHub accounts and repository review configuration.
        </p>
      </div>
      <AccountsSection />
      <ReposSection />
    </div>
  );
}
