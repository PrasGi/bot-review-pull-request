import * as React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

type Installation = { login: string; type: 'User' | 'Organization'; href?: string };

type AccountCardProps = {
  displayName: string;
  login: string;
  avatarUrl?: string;
  repoCount: number;
  reconnectRequired?: boolean;
  syncing?: boolean;
  onResync?: () => void;
  installations?: Installation[];
  /** Extra content under the header, e.g. a reconnect prompt. */
  children?: React.ReactNode;
};

function AccountCard({
  displayName,
  login,
  avatarUrl,
  repoCount,
  reconnectRequired = false,
  syncing = false,
  onResync,
  installations,
  children,
}: AccountCardProps): React.ReactElement {
  return (
    <Card hoverLift className="prr-account">
      <div className="prr-account-top">
        <Avatar name={displayName || login} src={avatarUrl} tone="accent" />
        <div className="prr-account-id">
          <div className="prr-account-name-row">
            <span className="prr-account-name">{displayName}</span>
            {reconnectRequired && <Badge variant="warning">! Reconnect required</Badge>}
          </div>
          <p className="prr-hint prr-mono">@{login}</p>
        </div>
        <div className="prr-account-side">
          <span className="prr-mono prr-hint">
            {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            loading={syncing}
            disabled={reconnectRequired || syncing}
            onClick={onResync}
            aria-label={`Re-sync ${login}`}
          >
            {!syncing && <Icon name="refresh" size={14} />}
            Re-sync
          </Button>
        </div>
      </div>
      {installations && installations.length > 0 && (
        <div className="prr-chips">
          {installations.map((inst) => (
            <a key={inst.login} className="prr-chip" href={inst.href ?? '#'} target="_blank" rel="noopener noreferrer">
              <Icon name={inst.type === 'Organization' ? 'building' : 'user'} size={12} />
              {inst.login}
            </a>
          ))}
        </div>
      )}
      {children}
    </Card>
  );
}

export { AccountCard };
export type { AccountCardProps, Installation };
