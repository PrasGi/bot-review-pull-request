'use client';

import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { Button } from './Button';

const Dialog = RadixDialog.Root;
const DialogTrigger = RadixDialog.Trigger;
const DialogClose = RadixDialog.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof RadixDialog.Overlay>,
  RadixDialog.DialogOverlayProps
>(({ className, ...props }, ref) => (
  <RadixDialog.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof RadixDialog.Content>,
  RadixDialog.DialogContentProps & { showClose?: boolean }
>(({ className, children, showClose = true, ...props }, ref) => (
  <RadixDialog.Portal>
    <DialogOverlay />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        'glass-card fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-6',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2',
        'data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]',
        className
      )}
      {...props}
    >
      {children}
      {showClose && (
        <RadixDialog.Close
          className={cn(
            'absolute right-4 top-4 rounded-md p-1 text-[var(--text-muted)]',
            'hover:bg-[var(--nav-hover)] hover:text-[var(--text)] transition-colors',
            'focus-visible:outline-2 focus-visible:outline-[var(--accent)]'
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </RadixDialog.Close>
      )}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('mb-4 space-y-1', className)} {...props} />;
}

function DialogTitle({ className, ...props }: RadixDialog.DialogTitleProps): React.ReactElement {
  return (
    <RadixDialog.Title
      className={cn('text-base font-semibold text-[var(--text)]', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: RadixDialog.DialogDescriptionProps): React.ReactElement {
  return (
    <RadixDialog.Description
      className={cn('text-sm text-[var(--text-muted)]', className)}
      {...props}
    />
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
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  ConfirmDialog,
};
export type { ConfirmDialogProps };
