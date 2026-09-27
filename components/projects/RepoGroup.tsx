import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { Switch } from '@/components/ui/Switch';

type RepoGroupProps = { title: string; count?: number; children?: React.ReactNode };

function RepoGroup({ title, count, children }: RepoGroupProps): React.ReactElement {
  return (
    <section className="prr-repo-group">
      <div className="prr-repo-group-head">
        <Icon name="folder" />
        <span>{title}</span>
        <Badge>{count ?? React.Children.count(children)}</Badge>
      </div>
      <div className="prr-repo-rows">{children}</div>
    </section>
  );
}

type RepoRowProps = {
  fullName: string;
  enabled: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  toggling?: boolean;
  lastEventAt?: string;
  removed?: boolean;
  onConfigure?: () => void;
  /** Shown only when `onSelectedChange` is set. */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** Short config summary, e.g. "Chill · glm-5.2". */
  meta?: string;
};

function RepoRow({
  fullName,
  enabled,
  onEnabledChange,
  toggling,
  lastEventAt,
  removed,
  onConfigure,
  selected = false,
  onSelectedChange,
  meta,
}: RepoRowProps): React.ReactElement {
  return (
    <div className={cn('prr-repo-row', removed && 'is-removed')}>
      {onSelectedChange && (
        <Checkbox
          checked={selected}
          onChange={(e) => onSelectedChange(e.target.checked)}
          disabled={removed}
          aria-label={`Select ${fullName}`}
        />
      )}
      <Icon name="fork" />
      <div className="prr-repo-name">
        <span>{fullName}</span>
        {removed && <Badge>Removed</Badge>}
      </div>
      {meta && <span className="prr-repo-time">{meta}</span>}
      {lastEventAt && <time className="prr-repo-time">{lastEventAt}</time>}
      <Switch
        checked={enabled}
        onCheckedChange={onEnabledChange}
        disabled={removed || toggling}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${fullName}`}
      />
      <Button variant="ghost" size="sm" disabled={removed} onClick={onConfigure} aria-label={`Configure ${fullName}`}>
        Configure
      </Button>
    </div>
  );
}

export { RepoGroup, RepoRow };
export type { RepoGroupProps, RepoRowProps };
