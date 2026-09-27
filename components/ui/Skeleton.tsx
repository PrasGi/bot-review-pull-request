import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type SkeletonProps = React.HTMLAttributes<HTMLSpanElement>;

function Skeleton({ className, ...props }: SkeletonProps): React.ReactElement {
  return <span className={cn('prr-skel', className)} aria-hidden="true" {...props} />;
}

export { Skeleton };
export type { SkeletonProps };
