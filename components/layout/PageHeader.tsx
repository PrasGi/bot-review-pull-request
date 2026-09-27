import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  kicker?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  /** A back control rendered before the title, e.g. a `Link` styled as an icon button. */
  back?: React.ReactNode;
  className?: string;
};

function PageHeader({ title, description, kicker, badge, actions, back, className }: PageHeaderProps): React.ReactElement {
  return (
    <div className={cn('prr-page-head', className)}>
      {back}
      <div className="prr-page-head-text">
        {kicker && <p className="prr-card-kicker">{kicker}</p>}
        <div className="prr-page-title-row">
          <h1 className="prr-page-title">{title}</h1>
          {badge}
        </div>
        {description && <p className="prr-page-desc">{description}</p>}
      </div>
      {actions && <div className="prr-page-actions">{actions}</div>}
    </div>
  );
}

type SectionHeadingProps = {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
};

function SectionHeading({ children, count, action, as: Tag = 'h2', className }: SectionHeadingProps): React.ReactElement {
  return (
    <div className={cn('prr-section-head', className)}>
      <Tag className="prr-section-title">
        {children}
        {count !== undefined && <span className="prr-section-count">{count}</span>}
      </Tag>
      {action}
    </div>
  );
}

export { PageHeader, SectionHeading };
export type { PageHeaderProps, SectionHeadingProps };
