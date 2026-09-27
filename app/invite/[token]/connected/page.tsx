import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/data/States';
import {
  CONNECTED_PAGE_COPY as COPY,
  INACTIVE_REASON_COPY,
  INVITE_PAGE_COPY,
} from '@/lib/invites/copy';
import { findInviteByToken } from '@/lib/invites/invite';
import { loadConnectionSummary } from '@/lib/invites/load';
import { inviteStatus } from '@/lib/invites/status';
import type { ConnectedRepoRow } from '@/lib/invites/summary';
import { invitePath } from '@/lib/invites/urls';
import { InviteState } from '../../InviteState';
import { AutoRefresh } from './AutoRefresh';
import styles from '../../invite.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: COPY.metaTitle,
  robots: { index: false, follow: false },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RepoRow({ row }: { row: ConnectedRepoRow }): React.ReactElement {
  return (
    <tr>
      <td>
        <code className="prr-cell-title">{row.fullName}</code>
      </td>
      <td>
        <Badge variant={row.active ? 'success' : 'error'}>{row.active ? COPY.active : COPY.inactive}</Badge>
        {row.reason && <p className="prr-cell-sub">{INACTIVE_REASON_COPY[row.reason]}</p>}
      </td>
      <td>
        {row.model ? (
          <>
            <code className="prr-cell-title">{row.model}</code>
            <p className="prr-cell-sub">
              {row.providerLabel}
              {row.modelIsDefault && ` · ${COPY.defaultModel}`}
            </p>
          </>
        ) : (
          <span className="prr-cell-sub">{COPY.noModel}</span>
        )}
      </td>
      <td>
        <div className={styles.character}>
          <span className="prr-cell-title">{row.character.label}</span>
          <span className="prr-cell-sub">{row.character.description}</span>
          <span className="prr-cell-sub">{row.character.limits}</span>
          {row.authorOverrides.length > 0 && (
            <ul className={styles.overrides} aria-label={COPY.authorOverrides}>
              {row.authorOverrides.map((o) => (
                <li key={o.login} className="prr-cell-sub">
                  <code>@{o.login}</code> → {o.character.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </td>
    </tr>
  );
}

export default async function ConnectedInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}): Promise<React.ReactElement> {
  const [{ token }, { status: callbackStatus }] = await Promise.all([params, searchParams]);
  const invite = await findInviteByToken(token);

  if (!invite) {
    const state = INVITE_PAGE_COPY.states.invalid;
    return (
      <main className={styles.page}>
        <InviteState badge={state.badge} tone="error" title={state.title} body={state.body} />
      </main>
    );
  }

  const status = inviteStatus(invite);
  // A completed invite always wins, even if this URL still says pending or error.
  if (status !== 'completed') {
    let content: React.ReactElement;
    if (status === 'revoked' || status === 'expired') {
      const state = INVITE_PAGE_COPY.states[status];
      content = (
        <InviteState
          badge={state.badge}
          tone={status === 'expired' ? 'warning' : 'error'}
          title={state.title}
          body={state.body}
        />
      );
    } else if (callbackStatus === 'pending') {
      content = <InviteState badge={COPY.pending.badge} tone="warning" title={COPY.pending.title} body={COPY.pending.body} />;
    } else if (callbackStatus === 'error') {
      content = (
        <InviteState badge={COPY.error.badge} tone="error" title={COPY.error.title} body={COPY.error.body}>
          <Link href={invitePath(token)} className="prr-link">
            {COPY.error.retry}
          </Link>
        </InviteState>
      );
    } else {
      content = (
        <InviteState badge={COPY.waiting.badge} tone="info" title={COPY.waiting.title} body={COPY.waiting.body}>
          <AutoRefresh />
        </InviteState>
      );
    }
    return <main className={styles.page}>{content}</main>;
  }

  const summary = await loadConnectionSummary(invite);
  const org = invite.accountLogin || invite.targetLogin;

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <header className={styles.hero}>
          <span className="prr-brand-mark is-lg" aria-hidden="true">
            <Icon name="pr" size={24} />
          </span>
          <Badge variant="success">{COPY.connected.badge}</Badge>
          <h1 className={styles.title}>{COPY.connected.title(org)}</h1>
          <p className={styles.lead}>
            {COPY.connected.body(
              formatDate(invite.completedAt ?? invite.createdAt),
              summary.activeCount,
              summary.rows.length
            )}
          </p>
        </header>

        <section aria-labelledby="repos-heading">
          <SectionHeading count={summary.rows.length}>
            <span id="repos-heading">{COPY.reposHeading}</span>
          </SectionHeading>
          {summary.rows.length === 0 ? (
            <Card>
              <EmptyState icon="folder" title={COPY.noRepos.title} description={COPY.noRepos.body} />
            </Card>
          ) : (
            <div className="prr-table-card">
              <div className="prr-table-scroll">
                <table className="prr-table">
                  <thead>
                    <tr>
                      <th scope="col">{COPY.reposHeading}</th>
                      <th scope="col">{COPY.columns.status}</th>
                      <th scope="col">{COPY.columns.model}</th>
                      <th scope="col">{COPY.columns.character}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((row) => (
                      <RepoRow key={row.fullName} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>{COPY.triggerHeading}</h2>
          <p className={styles.body}>
            {summary.reviewerLogin ? COPY.trigger(summary.reviewerLogin) : COPY.triggerUnknown}
          </p>
        </Card>
      </div>
    </main>
  );
}
