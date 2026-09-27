import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type CardProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  hoverLift?: boolean;
  kicker?: React.ReactNode;
  title?: React.ReactNode;
};

function Card({ hoverLift = false, kicker, title, className, children, ...props }: CardProps): React.ReactElement {
  return (
    <div className={cn('prr-card', hoverLift && 'prr-card--lift', className)} {...props}>
      {kicker && <p className="prr-card-kicker">{kicker}</p>}
      {title && <h3 className="prr-card-title">{title}</h3>}
      {children}
    </div>
  );
}

export { Card };
export type { CardProps };
