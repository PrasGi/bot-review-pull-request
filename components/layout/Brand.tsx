import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Icon } from '@/components/ui/Icon';

type BrandMarkProps = { name?: string; compact?: boolean; className?: string };

/** The pull-request glyph on an accent square, with the product name unless compact. */
function BrandMark({ name = 'PR Reviewer', compact = false, className }: BrandMarkProps): React.ReactElement {
  return (
    <div className={cn('prr-brand', className)}>
      <span className="prr-brand-mark" aria-hidden="true">
        <Icon name="pr" size={compact ? 18 : 16} />
      </span>
      {!compact && <span className="prr-brand-name">{name}</span>}
    </div>
  );
}

export { BrandMark };
