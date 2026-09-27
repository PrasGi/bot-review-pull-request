'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { PageHeader, SectionHeading } from '@/components/layout/PageHeader';
import { Grid } from '@/components/layout/Grid';
import { EmptyState, ErrorState } from '@/components/data/States';
import { Pagination } from '@/components/data/Pagination';
import { AccountCard } from '@/components/projects/AccountCard';
import { RepoGroup, RepoRow } from '@/components/projects/RepoGroup';
import { fetcher, mutateJson, FetchError } from '@/lib/ui/swr';
import { RepoConfigDialog } from './RepoConfigDialog';
import { InviteOrgDialog } from './InviteOrgDialog';
import { INVITES_KEY, OwnerInvites } from './OwnerInvites';
import { INVITE_DIALOG_COPY } from '@/lib/invites/copy';
import type { RepoConfig } from './RepoConfigDialog';
import styles from './page.module.css';

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
  authorizeUrl: string;
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

function ConnectedAccount({
  account,
  onResynced,
}: {
  account: Account;
  onResynced: () => Promise<void>;
}): React.ReactElement {
  const [syncing, setSyncing] = React.useState(false);

  const handleResync = async (): Promise<void> => {
    setSyncing(true);
    try {
      const res = await mutateJson<{ repoCount: number }>(`/api/dashboard/accounts/${account.id}/resync`, 'POST');
      toast.success('Re-sync complete', `${res.repoCount} repositories synced.`);
      await onResynced();
    } catch (e) {
      const message = e instanceof FetchError ? e.message : 'Re-sync failed';
      toast.error('Re-sync failed', message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AccountCard
      displayName={account.displayName}
      login={account.githubLogin}
      avatarUrl={account.avatarUrl}
      repoCount={account.repoCount}
      reconnectRequired={account.reconnectRequired}
      syncing={syncing}
      onResync={handleResync}
      installations={account.installations.map((inst) => ({
        login: inst.accountLogin,
        type: inst.accountType,
        href: inst.manageUrl,
      }))}
    />
  );
}

function AccountsSkeleton(): React.ReactElement {
  return (
    <Grid variant="pair" role="status" aria-label="Loading accounts">
      {[0, 1].map((i) => (
        <Card key={i}>
          <div className={styles.skeletonRow}>
            <Skeleton style={{ width: 40, height: 40 }} />
            <div className={styles.skeletonLines}>
              <Skeleton style={{ width: 144, height: 14 }} />
              <Skeleton style={{ width: 96, height: 12 }} />
            </div>
          </div>
        </Card>
      ))}
    </Grid>
  );
}

function AccountsSection(): React.ReactElement {
  const { data, error, isLoading, mutate } = useSWR<AccountsResponse>(
    '/api/dashboard/accounts',
    fetcher
  );
  const handleResynced = React.useCallback(async (): Promise<void> => {
    await Promise.all([mutate(), globalMutate('/api/dashboard/repos')]);
  }, [mutate]);
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

  const [inviteOpen, setInviteOpen] = React.useState(false);

  const headingActions = data?.connectUrl ? (
    <div className={styles.headingActions}>
      <Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}>
        <Icon name="building" size={14} />
        {INVITE_DIALOG_COPY.trigger}
      </Button>
      <a href={data.connectUrl} className={buttonClass('secondary', 'sm')}>
        <Icon name="link" size={14} />
        Connect GitHub account
      </a>
    </div>
  ) : null;

  return (
    <section aria-labelledby="accounts-heading">
      <SectionHeading action={data && data.accounts.length > 0 ? headingActions : null}>
        <span id="accounts-heading">Connected accounts</span>
      </SectionHeading>

      {isLoading && <AccountsSkeleton />}

      {error instanceof Error && (
        <ErrorState
          title="Could not load accounts"
          message={error instanceof FetchError ? error.message : 'Failed to load accounts'}
          onRetry={() => void mutate()}
        />
      )}

      {data && data.accounts.length === 0 && (
        <Card>
          <EmptyState
            icon="folder"
            title="No accounts connected yet"
            description="Connect a GitHub account to start reviewing pull requests. If the app is already installed on it, sign in instead."
            action={
              <div className={styles.headingActions}>
                <a href={data.connectUrl} className={buttonClass('primary')}>
                  <Icon name="plus" />
                  Connect GitHub account
                </a>
                <a href={data.authorizeUrl} className={buttonClass('secondary')}>
                  <Icon name="user" />
                  Already installed? Sign in
                </a>
                <Button variant="secondary" onClick={() => setInviteOpen(true)}>
                  <Icon name="building" />
                  {INVITE_DIALOG_COPY.trigger}
                </Button>
              </div>
            }
          />
        </Card>
      )}

      {data && data.accounts.length > 0 && (
        <Grid variant="pair">
          {data.accounts.map((account) => (
            <ConnectedAccount key={account.id} account={account} onResynced={handleResynced} />
          ))}
        </Grid>
      )}

      {data && data.pendingInstallations.length > 0 && (
        <div className={styles.pending}>
          <h3 className="prr-label">Pending owner approval</h3>
          <Grid variant="pair">
            {data.pendingInstallations.map((p) => (
              <div key={p.accountLogin} className="prr-attn prr-attn--warning">
                <span className="prr-attn-icon" aria-hidden="true">
                  <Icon name="clock" />
                </span>
                <div className="prr-attn-body">
                  <div className={styles.pendingTitle}>
                    <code className="prr-attn-title">{p.accountLogin}</code>
                    <Badge variant="warning">! Awaiting approval</Badge>
                  </div>
                  <p className="prr-hint">
                    Requested by @{p.requesterLogin} · {new Date(p.requestedAt).toLocaleDateString()}
                  </p>
                  <p className="prr-hint">
                    An owner of {p.accountLogin} must approve the GitHub App installation. It appears here
                    automatically once approved.
                  </p>
                </div>
              </div>
            ))}
          </Grid>
        </div>
      )}

      {data && data.accounts.length > 0 && <OwnerInvites />}

      {inviteOpen && data && (
        <InviteOrgDialog
          open
          onOpenChange={setInviteOpen}
          reviewers={data.accounts.map((a) => ({ id: a.id, githubLogin: a.githubLogin }))}
          connectUrl={data.connectUrl}
          onCreated={() => void globalMutate(INVITES_KEY)}
        />
      )}
    </section>
  );
}

type RepoItemProps = {
  repo: Repo;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onConfigSaved: () => void;
};

function RepoItem({ repo, onToggle, onConfigSaved }: RepoItemProps): React.ReactElement {
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
      <RepoRow
        fullName={repo.fullName}
        enabled={repo.enabled}
        onEnabledChange={handleToggle}
        toggling={toggling}
        removed={repo.removedFromInstallation}
        lastEventAt={repo.lastEventAt ? new Date(repo.lastEventAt).toLocaleDateString() : undefined}
        onConfigure={() => setConfigOpen(true)}
      />
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

const PAGE_SIZE = 15;

function ReposSkeleton(): React.ReactElement {
  return (
    <div className={styles.groups} role="status" aria-label="Loading repositories">
      {[0, 1].map((i) => (
        <Card key={i}>
          <Skeleton style={{ width: 112, height: 14, marginBottom: 16 }} />
          {[0, 1, 2].map((j) => (
            <Skeleton key={j} style={{ height: 20, marginBottom: 12 }} />
          ))}
        </Card>
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

  return (
    <section aria-labelledby="repos-heading">
      <SectionHeading
        action={
          data && data.repos.length > 0 ? (
            <Input
              key={q}
              id="repo-search"
              type="search"
              placeholder="Search repositories…"
              defaultValue={q}
              onChange={handleSearchChange}
              aria-label="Search repositories"
              containerClassName={styles.search}
            />
          ) : null
        }
      >
        <span id="repos-heading">Repositories</span>
      </SectionHeading>

      {isLoading && <ReposSkeleton />}

      {error instanceof Error && (
        <ErrorState
          title="Could not load repositories"
          message={error instanceof FetchError ? error.message : 'Failed to load repositories'}
          onRetry={() => void mutate()}
        />
      )}

      {data && data.repos.length === 0 && (
        <Card>
          <EmptyState
            icon="fork"
            title="No repositories yet"
            description="Connect an account and install the GitHub app to see repositories here."
          />
        </Card>
      )}

      {data && data.repos.length > 0 && filteredRepos.length === 0 && (
        <Card>
          <EmptyState title="No repositories match" description="Try a different search term." />
        </Card>
      )}

      {data && filteredRepos.length > 0 && (
        <div className={styles.groups}>
          {grouped.map(([accountLogin, repos]) => (
            <RepoGroup key={accountLogin} title={accountLogin} count={repos.length}>
              {repos.map((repo) => (
                <RepoItem key={repo.id} repo={repo} onToggle={handleToggle} onConfigSaved={handleConfigSaved} />
              ))}
            </RepoGroup>
          ))}
          <Pagination page={page} totalPages={totalPages} total={totalFiltered} onPageChange={goToPage} />
        </div>
      )}
    </section>
  );
}

export default function ProjectsPage(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage connected GitHub accounts and repository review configuration."
      />
      <AccountsSection />
      <ReposSection />
    </>
  );
}
