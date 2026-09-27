'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type TriggerProps = {
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
  'aria-expanded'?: boolean;
};

const CloseMenu = React.createContext<() => void>(() => {});

type DropdownMenuProps = {
  trigger: React.ReactElement<TriggerProps>;
  align?: 'start' | 'end';
  side?: 'bottom' | 'top';
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children?: React.ReactNode;
};

/** Menu of actions under a trigger. Arrow keys move between items; Esc closes and refocuses the trigger. */
function DropdownMenu({
  trigger,
  align = 'start',
  side = 'bottom',
  defaultOpen = false,
  onOpenChange,
  className,
  children,
}: DropdownMenuProps): React.ReactElement {
  const [open, setOpenState] = React.useState(defaultOpen);
  const wrap = React.useRef<HTMLDivElement>(null);
  const list = React.useRef<HTMLDivElement>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  React.useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('.prr-menu-item:not([disabled])')?.focus();
    const onPointerDown = (e: MouseEvent): void => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, setOpen]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      wrap.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
      return;
    }
    if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || !list.current) return;
    e.preventDefault();
    const items = Array.from(list.current.querySelectorAll<HTMLElement>('.prr-menu-item:not([disabled])'));
    const n = items.length;
    if (!n) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus();
  };

  const triggerEl = React.cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(e);
      setOpen(!open);
    },
  });

  return (
    <CloseMenu.Provider value={() => setOpen(false)}>
      <div ref={wrap} className="prr-menu-wrap" onKeyDown={onKeyDown}>
        {triggerEl}
        {open && (
          <div
            ref={list}
            role="menu"
            className={cn('prr-menu', align === 'end' && 'prr-menu--end', side === 'top' && 'prr-menu--top', className)}
          >
            {children}
          </div>
        )}
      </div>
    </CloseMenu.Provider>
  );
}

type DropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
  onSelect?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

function DropdownMenuItem({ destructive, onSelect, onClick, className, children, ...props }: DropdownMenuItemProps): React.ReactElement {
  const close = React.useContext(CloseMenu);
  return (
    <button
      type="button"
      role="menuitem"
      className={cn('prr-menu-item', destructive && 'prr-menu-item--destructive', className)}
      onClick={(e) => {
        onSelect?.(e);
        onClick?.(e);
        close();
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function DropdownMenuLabel({ children }: { children?: React.ReactNode }): React.ReactElement {
  return <div className="prr-menu-label">{children}</div>;
}

function DropdownMenuSeparator(): React.ReactElement {
  return <div className="prr-menu-sep" role="separator" />;
}

export { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator };
export type { DropdownMenuProps, DropdownMenuItemProps };
