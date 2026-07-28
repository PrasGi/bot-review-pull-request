import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className, ...props }: SkeletonProps): React.ReactElement {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[var(--nav-hover)]',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
