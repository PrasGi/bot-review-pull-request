import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps): React.ReactElement {
  return (
    <span className={cn('prr-badge', `prr-badge--${variant}`, className)} {...props}>
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, BadgeVariant };
