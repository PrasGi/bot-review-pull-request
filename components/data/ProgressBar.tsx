import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import styles from './ProgressBar.module.css';

type ProgressBarProps = {
  /** 0–100, or null while the total is unknown (indeterminate). */
  value: number | null;
  label: string;
  /** Text read out with the value, e.g. "7 of 15 steps". */
  valueText?: string;
  className?: string;
};

/** The kit's meter track, as a progressbar. Indeterminate runs a stripe instead of a fill. */
function ProgressBar({ value, label, valueText, className }: ProgressBarProps): React.ReactElement {
  const clamped = value === null ? null : Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn('prr-budget-track', styles.track, className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped ?? undefined}
      aria-valuetext={valueText}
      aria-busy={clamped === null || undefined}
    >
      {clamped === null ? (
        <span className={styles.indeterminate} aria-hidden="true" />
      ) : (
        <span className={cn('prr-budget-fill', styles.fill)} style={{ width: `${clamped}%` }} aria-hidden="true" />
      )}
    </div>
  );
}

export { ProgressBar };
export type { ProgressBarProps };
