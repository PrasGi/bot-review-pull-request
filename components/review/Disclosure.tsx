import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Icon } from '@/components/ui/Icon';

type DisclosureProps = { summary: React.ReactNode; children?: React.ReactNode; defaultOpen?: boolean; className?: string };

function Disclosure({ summary, children, defaultOpen = false, className }: DisclosureProps): React.ReactElement {
  return (
    <details className={cn('prr-disclosure', className)} open={defaultOpen}>
      <summary>
        <span className="prr-disclosure-caret" aria-hidden="true">
          <Icon name="chevronRight" size={14} />
        </span>
        {summary}
      </summary>
      <div className="prr-disclosure-body">{children}</div>
    </details>
  );
}

export { Disclosure };
export type { DisclosureProps };
