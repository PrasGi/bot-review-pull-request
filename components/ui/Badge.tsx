import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/ui/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium leading-none',
  {
    variants: {
      variant: {
        success: 'bg-[oklch(0.70_0.15_142/0.15)] text-[oklch(0.50_0.15_142)]',
        warning: 'bg-[oklch(0.80_0.12_85/0.15)] text-[oklch(0.55_0.14_85)]',
        error: 'bg-[oklch(0.60_0.20_25/0.15)] text-[oklch(0.50_0.20_25)]',
        info: 'bg-[oklch(0.65_0.15_240/0.15)] text-[oklch(0.45_0.15_240)]',
        neutral: 'bg-[var(--nav-hover)] text-[var(--text-muted)]',
        accent: 'bg-[var(--accent-subtle)] text-[var(--accent)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, children, ...props }: BadgeProps): React.ReactElement {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
