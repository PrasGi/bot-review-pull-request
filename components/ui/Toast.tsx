'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useMounted } from '@/lib/ui/use-mounted';

type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'loading';
type ToastItem = { id: number; kind: ToastKind; message: string; description?: string };
type ToastOptions = { duration?: number };

// A tiny module-level store: `toast.*` can be called from anywhere, and the
// single <AppToaster /> in the root layout renders the queue.
let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit(): void {
  for (const listener of listeners) listener();
}

function dismiss(id?: number): void {
  items = id === undefined ? [] : items.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, description?: string, opts?: ToastOptions): number {
  const id = ++seq;
  const duration = opts?.duration ?? 4000;
  items = [...items, { id, kind, message, description }];
  emit();
  if (kind !== 'loading' && Number.isFinite(duration)) setTimeout(() => dismiss(id), duration);
  return id;
}

const toast = {
  success: (message: string, description?: string, opts?: ToastOptions) => push('success', message, description, opts),
  error: (message: string, description?: string, opts?: ToastOptions) => push('error', message, description, opts),
  warning: (message: string, description?: string, opts?: ToastOptions) => push('warning', message, description, opts),
  info: (message: string, description?: string, opts?: ToastOptions) => push('info', message, description, opts),
  loading: (message: string) => push('loading', message),
  dismiss,
};

const MARK: Record<ToastKind, string> = { success: '✓', error: '✕', warning: '!', info: 'i', loading: '◼' };

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function AppToaster(): React.ReactElement | null {
  const list = React.useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY
  );
  const mounted = useMounted();
  if (!mounted) return null;

  return createPortal(
    <div className="prr-toaster" role="region" aria-label="Notifications" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`prr-toast prr-toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span className="prr-toast-mark" aria-hidden="true">
            {MARK[t.kind]}
          </span>
          <div>
            <p className="prr-toast-title">{t.message}</p>
            {t.description && <p className="prr-toast-desc">{t.description}</p>}
          </div>
          <button type="button" className="prr-toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

export { AppToaster, toast };
