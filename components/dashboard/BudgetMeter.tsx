import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Badge } from '@/components/ui/Badge';

type BudgetMeterProps = {
  spent: number;
  limit: number;
  format?: (value: number) => string;
  label?: string;
  overMessage?: string;
};

const usd = (v: number): string => `$${v.toFixed(2)}`;

/** Turns warning at 80% and hatched error once spend passes the limit. */
function BudgetMeter({
  spent,
  limit,
  format = usd,
  label = 'Daily budget',
  overMessage = 'Daily spend has exceeded the configured budget.',
}: BudgetMeterProps): React.ReactElement {
  const safeLimit = limit > 0 ? limit : 1;
  const pct = Math.min(100, (spent / safeLimit) * 100);
  const over = spent > safeLimit;
  const warn = pct >= 80;
  const tone = over ? 'error' : warn ? 'warning' : 'accent';

  return (
    <div className={cn('prr-budget', `prr-budget--${tone}`)}>
      <div className="prr-budget-head">
        <span className="prr-label">{label}</span>
        <span className="prr-budget-nums">
          {format(spent)}
          <span> / {format(safeLimit)}</span>
        </span>
        {over ? (
          <Badge variant="error">✕ Over</Badge>
        ) : warn ? (
          <Badge variant="warning">! {Math.round(pct)}%</Badge>
        ) : (
          <Badge variant="neutral">{Math.round(pct)}%</Badge>
        )}
      </div>
      <div
        className="prr-budget-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={safeLimit}
        aria-valuenow={spent}
        aria-label={label}
      >
        <span className="prr-budget-fill" style={{ width: `${pct}%` }} />
      </div>
      {over && (
        <p className="prr-error" style={{ marginTop: 8 }}>
          {overMessage}
        </p>
      )}
    </div>
  );
}

export { BudgetMeter };
export type { BudgetMeterProps };
