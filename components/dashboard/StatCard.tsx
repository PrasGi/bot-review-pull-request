import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Card } from '@/components/ui/Card';
import { renderIcon, type IconLike } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';

type StatCardProps = {
  label: string;
  value?: React.ReactNode;
  icon?: IconLike;
  /** Signed change, e.g. "+12%" or "-3%". The sign picks the arrow and tone. */
  delta?: string;
  hint?: string;
  loading?: boolean;
  hoverLift?: boolean;
};

function StatCard({ label, value, icon, delta, hint, loading = false, hoverLift = true }: StatCardProps): React.ReactElement {
  if (loading) {
    return (
      <Card className="prr-stat" aria-busy="true">
        <Skeleton style={{ width: 112, height: 14 }} />
        <Skeleton style={{ width: 80, height: 32, marginTop: 12 }} />
        <Skeleton style={{ width: 64, height: 10, marginTop: 12 }} />
      </Card>
    );
  }
  const down = delta?.startsWith('-') ?? false;
  return (
    <Card hoverLift={hoverLift} className="prr-stat">
      <div className="prr-stat-top">
        <span className="prr-stat-label">{label}</span>
        {icon && (
          <span className="prr-stat-icon" aria-hidden="true">
            {renderIcon(icon, 16)}
          </span>
        )}
      </div>
      <p className="prr-stat-value">{value}</p>
      {delta ? (
        <p className={cn('prr-stat-delta', down ? 'is-down' : 'is-up')}>
          {down ? '▼ ' : '▲ '}
          {delta.replace(/^[+-]/, '')}
          {hint && <span> {hint}</span>}
        </p>
      ) : hint ? (
        <p className="prr-hint" style={{ marginTop: 4 }}>
          {hint}
        </p>
      ) : null}
    </Card>
  );
}

type SummaryCardProps = { label: string; value?: React.ReactNode; loading?: boolean };

function SummaryCard({ label, value, loading = false }: SummaryCardProps): React.ReactElement {
  if (loading) {
    return (
      <Card className="prr-summary" aria-busy="true">
        <Skeleton style={{ width: 96, height: 12 }} />
        <Skeleton style={{ width: 72, height: 24, marginTop: 10 }} />
      </Card>
    );
  }
  return (
    <Card className="prr-summary">
      <p className="prr-stat-label">{label}</p>
      <p className="prr-summary-value">{value}</p>
    </Card>
  );
}

export { StatCard, SummaryCard };
export type { StatCardProps, SummaryCardProps };
