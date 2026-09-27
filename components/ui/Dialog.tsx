'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/ui/cn';
import { Button } from './Button';

const FOCUSABLE =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

type DialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  showClose?: boolean;
  role?: 'dialog' | 'alertdialog';
  className?: string;
  children?: React.ReactNode;
};

/** Modal dialog: traps focus, restores it on close, and treats Esc and the backdrop as cancel. */
function Dialog({
  open,
  onOpenChange,
  title,
  description,
  showClose = true,
  role = 'dialog',
  className,
  children,
}: DialogProps): React.ReactElement | null {
  const box = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = box.current;
    const first = el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onOpenChangeRef.current?.(false);
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const items = el.querySelectorAll<HTMLElement>(FOCUSABLE);
      const a = items[0];
      const z = items[items.length - 1];
      if (!a || !z) return;
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="prr-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange?.(false);
      }}
    >
      <div
        ref={box}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn('prr-dialog', className)}
      >
        {title && (
          <h2 id={titleId} className="prr-dialog-title">
            {title}
          </h2>
        )}
        {description && (
          <p id={descId} className="prr-dialog-desc">
            {description}
          </p>
        )}
        {children}
        {showClose && (
          <button type="button" className="prr-icon-btn" aria-label="Close" onClick={() => onOpenChange?.(false)}>
            ✕
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  loading?: boolean;
};

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  loading = false,
}: ConfirmDialogProps): React.ReactElement | null {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      showClose={false}
      role="alertdialog"
    >
      <div className="prr-dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export { Dialog, ConfirmDialog };
export type { DialogProps, ConfirmDialogProps };
