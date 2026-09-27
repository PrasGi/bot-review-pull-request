import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/ui/cn';
import { Badge } from '@/components/ui/Badge';
import { Icon, renderIcon, type IconLike } from '@/components/ui/Icon';

type AttentionTone = 'warning' | 'error' | 'neutral' | 'success';

const DEFAULT_ICON: Record<AttentionTone, IconLike> = {
  warning: 'plug',
  error: 'alert',
  neutral: 'wifiOff',
  success: 'check',
};

type AttentionItemProps = {
  tone?: AttentionTone;
  icon?: IconLike;
  title: React.ReactNode;
  tags?: string[];
  action?: { label: string; href: string };
};

function AttentionItem({ tone = 'warning', icon, title, tags, action }: AttentionItemProps): React.ReactElement {
  return (
    <div className={cn('prr-attn', `prr-attn--${tone}`)}>
      <span className="prr-attn-icon" aria-hidden="true">
        {renderIcon(icon ?? DEFAULT_ICON[tone], 16)}
      </span>
      <div className="prr-attn-body">
        <p className="prr-attn-title">{title}</p>
        {tags && tags.length > 0 && (
          <div className="prr-attn-tags">
            {tags.map((tag) => (
              <Badge key={tag} variant={tone}>
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {action && (
          <Link className="prr-link" href={action.href}>
            {action.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

type AttentionListProps = { children?: React.ReactNode; emptyText?: string };

function AttentionList({ children, emptyText = 'All clear — no issues to address' }: AttentionListProps): React.ReactElement {
  const items = React.Children.toArray(children);
  if (items.length) return <div className="prr-attn-list">{items}</div>;
  return (
    <div className="prr-all-clear">
      <span className="prr-all-clear-mark" aria-hidden="true">
        <Icon name="checkCheck" />
      </span>
      <span>{emptyText}</span>
    </div>
  );
}

export { AttentionItem, AttentionList };
export type { AttentionItemProps, AttentionTone };
