'use client';

import * as React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const COLLAPSED_KEY = 'sidebar:collapsed';
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type AppShellProps = {
  children: React.ReactNode;
  title?: React.ReactNode;
};

// The saved collapse preference, read through an external store so the server
// (which renders expanded) and the first client render agree.
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(onChange: () => void): () => void {
  collapseListeners.add(onChange);
  return () => collapseListeners.delete(onChange);
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, String(next));
  } catch {
    // Private-mode browsers reject writes; the preference just isn't remembered.
  }
  for (const listener of collapseListeners) listener();
}

function AppShell({ children, title }: AppShellProps): React.ReactElement {
  const collapsed = React.useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const drawer = React.useRef<HTMLDivElement>(null);

  // ⌘B / Ctrl+B toggles the sidebar.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        writeCollapsed(!collapsed);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [collapsed]);

  // Mobile drawer: lock page scroll, trap focus, close on Esc.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !drawer.current) return;
      const items = drawer.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [mobileOpen]);

  const closeDrawer = (): void => setMobileOpen(false);

  return (
    <div className="prr-shell">
      <Sidebar collapsed={collapsed} onCollapsedChange={writeCollapsed} className="prr-shell-side" />
      {mobileOpen && (
        <div
          ref={drawer}
          className="prr-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
        >
          <Sidebar mobile onClose={closeDrawer} onNavigate={closeDrawer} />
        </div>
      )}
      <div className="prr-shell-main">
        <Header title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="prr-shell-content">
          <div className="prr-shell-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { AppShell };
export type { AppShellProps };
