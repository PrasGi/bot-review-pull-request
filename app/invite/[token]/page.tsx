import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { buttonClass } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { DescriptionList } from '@/components/data/DescriptionList';
import { INVITE_PAGE_COPY as COPY, OPERATOR_NAME } from '@/lib/invites/copy';
import { findInviteByToken } from '@/lib/invites/invite';
import { loadReviewerLogin } from '@/lib/invites/load';
import { inviteStatus } from '@/lib/invites/status';
import { connectedPath } from '@/lib/invites/urls';
import { InviteState } from '../InviteState';
import styles from '../invite.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: COPY.metaTitle,
  robots: { index: false, follow: false },
};

const STATE_TONE: Record<keyof typeof COPY.states, BadgeVariant> = {
  invalid: 'error',
  revoked: 'error',
  expired: 'warning',
  completed: 'success',
};

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </Card>
  );
}

function Bullets({ items }: { items: readonly string[] }): React.ReactElement {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token } = await params;
  const invite = await findInviteByToken(token);
  const status = invite ? inviteStatus(invite) : 'invalid';

  if (!invite || status !== 'open') {
    const key = status === 'open' ? 'invalid' : status;
    const state = COPY.states[key];
    return (
      <main className={styles.page}>
        <InviteState badge={state.badge} tone={STATE_TONE[key]} title={state.title} body={state.body}>
          {status === 'completed' && (
            <Link href={connectedPath(token)} className="prr-link">
              {COPY.states.completed.link}
            </Link>
          )}
        </InviteState>
      </main>
    );
  }

  const reviewerLogin = await loadReviewerLogin(invite);
  const { what, permissions, data, remove, operator } = COPY.sections;

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <header className={styles.hero}>
          <span className="prr-brand-mark is-lg" aria-hidden="true">
            <Icon name="pr" size={24} />
          </span>
          <p className="prr-label">{COPY.kicker}</p>
          <h1 className={styles.title}>{COPY.title(invite.targetLogin)}</h1>
          {reviewerLogin && <p className={styles.lead}>{COPY.invitedBy(reviewerLogin)}</p>}
        </header>

        <Section title={what.title}>
          <Bullets items={what.body} />
        </Section>

        <Section title={permissions.title}>
          <DescriptionList items={permissions.items.map((item) => ({ term: item.term, value: item.value }))} />
          <p className="prr-hint">{permissions.note}</p>
        </Section>

        <Section title={data.title}>
          <Bullets items={data.body} />
        </Section>

        <Section title={remove.title}>
          <Bullets items={remove.body} />
        </Section>

        <Section title={operator.title}>
          <p className={styles.body}>{operator.body(OPERATOR_NAME)}</p>
        </Section>

        <div className={styles.cta}>
          {/* A plain anchor: the start route redirects to GitHub and must not be prefetched. */}
          <a href={`/api/invite/${encodeURIComponent(token)}/start`} className={buttonClass('primary')}>
            <Icon name="external" />
            {COPY.cta}
          </a>
          <p className="prr-hint">{COPY.ctaHint}</p>
        </div>
      </div>
    </main>
  );
}
