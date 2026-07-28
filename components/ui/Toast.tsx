'use client';

import type React from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';

function AppToaster(): React.ReactElement {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'glass-panel text-[var(--text)] border border-[var(--glass-border)] shadow-lg',
          title: 'font-medium text-sm',
          description: 'text-xs text-[var(--text-muted)]',
          actionButton: 'bg-[var(--accent)] text-[var(--accent-fg)] text-xs px-2 py-1 rounded',
          cancelButton: 'bg-[var(--nav-hover)] text-[var(--text-muted)] text-xs px-2 py-1 rounded',
          closeButton: 'text-[var(--text-muted)]',
        },
      }}
      richColors
    />
  );
}

const toast = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description }),
  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description }),
  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, { description }),
  info: (message: string, description?: string) =>
    sonnerToast.info(message, { description }),
  loading: (message: string) => sonnerToast.loading(message),
  dismiss: sonnerToast.dismiss,
};

export { AppToaster, toast };
