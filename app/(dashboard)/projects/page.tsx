'use client';

import * as React from 'react';
import useSWR from 'swr';
import { FolderGit2, GitFork, Building2, User, AlertTriangle, Plus, Link2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
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

type AccountsResponse = {
  accounts: Account[];
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
    account.displayName.charAt(0) ||
    account.githubLogin.charAt(0) ||
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

  const grouped = React.useMemo<[string, Repo[]][]>(() => {
    if (!data) return [];
    const map = new Map<string, Repo[]>();
    for (const repo of data.repos) {
      const list = map.get(repo.accountLogin) ?? [];
      list.push(repo);
      map.set(repo.accountLogin, list);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <section aria-labelledby="repos-heading">
      <div className="mb-4">
        <h2 id="repos-heading" className="text-lg font-semibold text-[var(--text)]">
          Repositories
        </h2>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
          Manage per-repository review configuration.
        </p>
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

      {data && data.repos.length > 0 && (
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
