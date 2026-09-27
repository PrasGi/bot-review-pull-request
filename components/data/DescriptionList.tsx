import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type DescriptionItem = { term: string; value: React.ReactNode; mono?: boolean };

type DescriptionListProps = { title?: string; items: DescriptionItem[]; className?: string };

function DescriptionList({ title, items, className }: DescriptionListProps): React.ReactElement {
  return (
    <div className={className}>
      {title && <h3 className="prr-dl-title">{title}</h3>}
      <dl className="prr-dl">
        {items.map((item) => (
          <React.Fragment key={item.term}>
            <dt>{item.term}</dt>
            <dd className={cn(item.mono && 'is-mono') || undefined}>{item.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

export { DescriptionList };
export type { DescriptionItem, DescriptionListProps };
