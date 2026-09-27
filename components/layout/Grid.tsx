import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import styles from './Grid.module.css';

type GridProps = React.HTMLAttributes<HTMLElement> & {
  /** `stats`: 4-up KPI tiles. `pair`: two-up charts or cards. */
  variant: 'stats' | 'pair';
  as?: 'div' | 'section';
};

function Grid({ variant, as: Tag = 'div', className, ...props }: GridProps): React.ReactElement {
  return <Tag className={cn(styles.grid, styles[variant], className)} {...props} />;
}

/** Vertical rhythm between page sections. */
function Stack({ as: Tag = 'div', className, ...props }: React.HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' }): React.ReactElement {
  return <Tag className={cn(styles.stack, className)} {...props} />;
}

export { Grid, Stack };
