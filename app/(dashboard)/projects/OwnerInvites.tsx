'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { EmptyState, ErrorState } from '@/components/data/States';
import { INVITE_LIST_COPY as COPY, REVOKE_INVITE_COPY } from '@/lib/invites/copy';
import type { InviteStatus } from '@/lib/invites/status';
import { fetcher, FetchError, mutateJson } from '@/lib/ui/swr';
import styles from './page.module.css';

export const INVITES_KEY = '/api/dashboard/invites';

type Invite = {
  id: string;
  targetLogin: string;
  status: InviteStatus;
  reviewerLogin: string | null;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
  accountLogin: string | null;
};

type InvitesResponse = { invites: Invite[] };

const STATUS_TONE: Record<InviteStatus, BadgeVariant> = {
  open: 'info',
  completed: 'success',
  revoked: 'neutral',
  expired: 'warning',
};

const STATUS_GLYPH: Record<InviteStatus, string> = {
  open: 'i',
  completed: '✓',
  revoked: '✕',
  expired: '!',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function detail(invite: Invite): string {
  if (invite.status === 'completed' && invite.completedAt) {
    return COPY.completed(invite.accountLogin ?? invite.targetLogin, formatDate(invite.completedAt));
  }
  return COPY.expires(formatDate(invite.expiresAt));
}

export function OwnerInvites(): React.ReactElement {
  const { data, error, isLoading, mutate } = useSWR<InvitesResponse>(INVITES_KEY, fetcher);
  const [revoking, setRevoking] = React.useState<Invite | null>(null);
  const [busy, setBusy] = React.useState(false);

  const confirmRevoke = async (): Promise<void> => {
    if (!revoking) return;
    setBusy(true);
    try {
      await mutateJson(`/api/dashboard/invites/${revoking.id}`, 'DELETE');
      toast.success(COPY.revoked);
      setRevoking(null);
      await mutate();
    } catch (err) {
      toast.error(COPY.revokeFailed, err instanceof FetchError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.pending}>
      <h3 className="prr-label">{COPY.heading}</h3>

      {isLoading && (
        <Card role="status" aria-label="Loading invites">
          <Skeleton style={{ width: 240, height: 14 }} />
        </Card>
      )}

      {error instanceof Error && (
        <ErrorState
          title="Could not load invites"
          message={error instanceof FetchError ? error.message : 'Failed to load invites'}
          onRetry={() => void mutate()}
        />
      )}

      {data && data.invites.length === 0 && (
        <Card>
          <EmptyState icon="link" title="No invites yet" description={COPY.empty} />
        </Card>
      )}

      {data && data.invites.length > 0 && (
        <div className="prr-repo-rows">
          {data.invites.map((invite) => (
            <div key={invite.id} className="prr-repo-row">
              <Icon name="building" />
              <div className="prr-repo-name">
                <code>{invite.targetLogin}</code>
                <Badge variant={STATUS_TONE[invite.status]}>
                  {STATUS_GLYPH[invite.status]} {COPY.status[invite.status]}
                </Badge>
              </div>
              <span className="prr-repo-time">{detail(invite)}</span>
              {invite.status === 'open' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevoking(invite)}
                  aria-label={`${COPY.revoke} invite for ${invite.targetLogin}`}
                >
                  {COPY.revoke}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRevoking(null);
        }}
        title={REVOKE_INVITE_COPY.title}
        description={REVOKE_INVITE_COPY.description}
        cancelLabel={REVOKE_INVITE_COPY.cancel}
        confirmLabel={REVOKE_INVITE_COPY.confirm}
        destructive
        onConfirm={() => void confirmRevoke()}
        loading={busy}
      />
    </div>
  );
}
