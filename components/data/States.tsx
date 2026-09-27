import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Button } from '@/components/ui/Button';
import { Icon, renderIcon, type IconLike } from '@/components/ui/Icon';

type EmptyStateProps = {
  title?: string;
  /** What will fill this view. */
  description?: string;
  icon?: IconLike;
  action?: React.ReactNode;
  className?: string;
};

function EmptyState({ title = 'Nothing here yet', description, icon = 'search', action, className }: EmptyStateProps): React.ReactElement {
  return (
    <div className={cn('prr-empty', className)}>
      <span className="prr-empty-mark" aria-hidden="true">
        {renderIcon(icon, 20)}
      </span>
      <p className="prr-empty-title">{title}</p>
      {description && <p className="prr-hint">{description}</p>}
      {action}
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  /** The server's message. */
  message?: string;
  onRetry?: () => void;
  className?: string;
};

function ErrorState({ title = 'Could not load data', message, onRetry, className }: ErrorStateProps): React.ReactElement {
  return (
    <div className={cn('prr-errstate', className)} role="alert">
      <span className="prr-errstate-mark" aria-hidden="true">
        <Icon name="alert" size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="prr-errstate-title">{title}</p>
        {message && <p className="prr-hint">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <Icon name="refresh" size={14} />
          Retry
        </Button>
      )}
    </div>
  );
}

export { EmptyState, ErrorState };
export type { EmptyStateProps, ErrorStateProps };
