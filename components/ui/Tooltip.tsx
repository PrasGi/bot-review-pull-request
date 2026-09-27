'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement<{ 'aria-describedby'?: string }>;
  side?: 'top' | 'bottom' | 'right';
  delayDuration?: number;
  className?: string;
};

/** Shows on hover and keyboard focus; Esc hides it. */
function Tooltip({ content, children, side = 'top', delayDuration = 150, className }: TooltipProps): React.ReactElement {
  const [show, setShow] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tipId = React.useId();

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const on = (): void => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(true), delayDuration);
  };
  const off = (): void => {
    clearTimeout(timer.current);
    setShow(false);
  };

  return (
    <span
      className="prr-tip-wrap"
      onMouseEnter={on}
      onMouseLeave={off}
      onFocus={on}
      onBlur={off}
      onKeyDown={(e) => {
        if (e.key === 'Escape') off();
      }}
    >
      {React.cloneElement(children, { 'aria-describedby': show ? tipId : undefined })}
      {show && (
        <span id={tipId} role="tooltip" className={cn('prr-tip', side !== 'top' && `prr-tip--${side}`, className)}>
          {content}
        </span>
      )}
    </span>
  );
}

export { Tooltip };
export type { TooltipProps };
