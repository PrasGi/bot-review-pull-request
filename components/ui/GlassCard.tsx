import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  hoverLift?: boolean;
};

function GlassCard({
  className,
  hoverLift = false,
  children,
  ...props
}: GlassCardProps): React.ReactElement {
  return (
    <div
      className={cn(
        'glass-card p-6',
        hoverLift && 'transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { GlassCard };
export type { GlassCardProps };
