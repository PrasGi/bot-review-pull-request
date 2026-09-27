'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type TriggerProps = {
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
  'aria-expanded'?: boolean;
};

type PopoverProps = {
  trigger: React.ReactElement<TriggerProps>;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'end';
  side?: 'bottom' | 'top';
  /** Accessible name of the panel. */
  label?: string;
  className?: string;
  wrapClassName?: string;
};

/** A panel anchored to its trigger. Clicking outside or pressing Esc closes it. */
function Popover({
  trigger,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  align = 'start',
  side = 'bottom',
  label,
  className,
  wrapClassName,
}: PopoverProps): React.ReactElement {
  const [inner, setInner] = React.useState(defaultOpen);
  const open = openProp ?? inner;
  const wrap = React.useRef<HTMLDivElement>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInner(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent): void => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setOpen]);

  const triggerEl = React.cloneElement(trigger, {
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(e);
      setOpen(!open);
    },
  });

  return (
    <div ref={wrap} className={cn('prr-menu-wrap', wrapClassName)}>
      {triggerEl}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            'prr-menu prr-pop',
            align === 'end' && 'prr-menu--end',
            side === 'top' && 'prr-menu--top',
            className
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export { Popover };
export type { PopoverProps };
