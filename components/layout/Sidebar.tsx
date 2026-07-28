'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  GitPullRequest,
  BarChart3,
  FolderGit2,
  Settings,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { Tooltip } from '@/components/ui/Tooltip';
import { ThemeToggle } from './ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { ConfirmDialog } from '@/components/ui/Dialog';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Requests', href: '/requests', icon: GitPullRequest },
  { label: 'AI Usage', href: '/usage', icon: BarChart3 },
  { label: 'Projects', href: '/projects', icon: FolderGit2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const STORAGE_KEY = 'sidebar:collapsed';

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar(): SidebarContextValue {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}

type SidebarProviderProps = {
  children: React.ReactNode;
};

function SidebarProvider({ children }: SidebarProviderProps): React.ReactElement {
  const [collapsed, setCollapsedState] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [collapsed, setCollapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}): React.ReactElement {
  const pathname = usePathname();
  const isActive =
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1',
        collapsed ? 'h-10 w-10 justify-center px-0' : 'h-10',
        isActive
          ? cn(
              'text-[var(--accent)] bg-[var(--accent-subtle)]',
              !collapsed && 'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-[3px] before:rounded-r before:bg-[var(--accent)]'
            )
          : 'text-[var(--text-muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--text)]'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed && (
        <span className="text-sm font-medium transition-opacity duration-150">
          {item.label}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip content={item.label} side="right">
        {linkContent}
      </Tooltip>
    );
  }

  return linkContent;
}

function AdminMenu({
  collapsed,
  align = 'end',
  side = 'top',
}: {
  collapsed: boolean;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
}): React.ReactElement {
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async (): Promise<void> => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  const trigger = (
    <button
      type="button"
      aria-label="Admin menu"
      className={cn(
        'flex items-center gap-2 rounded-md p-2 w-full transition-colors',
        'hover:bg-[var(--nav-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
        collapsed && 'justify-center'
      )}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-semibold select-none"
        aria-hidden="true"
      >
        AD
      </div>
      {!collapsed && (
        <div className="flex flex-1 min-w-0 flex-col items-start">
          <span className="text-sm font-medium text-[var(--text)] leading-none">Admin</span>
          <span className="text-xs text-[var(--text-muted)] truncate w-full">admin@example.com</span>
        </div>
      )}
      {!collapsed && <EllipsisVertical className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
    </button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent side={side} align={align} className="w-52">
          <div className="px-3 py-2">
            <ThemeToggle />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Log out of PR Reviewer?"
        description="You will be redirected to the login page."
        confirmLabel="Log out"
        destructive
        onConfirm={handleLogout}
        loading={loggingOut}
      />
    </>
  );
}

function DesktopSidebar(): React.ReactElement {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col glass-panel shrink-0 overflow-hidden h-full',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
      aria-label="Main navigation"
    >
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b border-[var(--glass-border)] shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-md bg-[var(--accent)] flex items-center justify-center shrink-0">
              <GitPullRequest className="h-4 w-4 text-[var(--accent-fg)]" aria-hidden="true" />
            </div>
            <span className="font-semibold text-sm text-[var(--text)] truncate">PR Reviewer</span>
          </div>
        )}
        {collapsed && (
          <div className="h-7 w-7 rounded-md bg-[var(--accent)] flex items-center justify-center">
            <GitPullRequest className="h-4 w-4 text-[var(--accent-fg)]" aria-hidden="true" />
          </div>
        )}
        <Tooltip content={collapsed ? 'Expand (⌘B)' : 'Collapse (⌘B)'} side="right">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors shrink-0',
              'text-[var(--text-muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--text)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
              collapsed && 'hidden'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </Tooltip>
        {collapsed && (
          <Tooltip content="Expand (⌘B)" side="right">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className={cn(
                'absolute bottom-auto flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                'text-[var(--text-muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--text)]',
                'focus-visible:outline-2 focus-visible:outline-[var(--accent)]'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="shrink-0 border-t border-[var(--glass-border)] p-2">
        <AdminMenu collapsed={collapsed} side="top" align={collapsed ? 'start' : 'end'} />
      </div>
    </aside>
  );
}

function MobileDrawer(): React.ReactElement {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const drawerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  React.useEffect(() => {
    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    if (mobileOpen) window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [mobileOpen, setMobileOpen]);

  React.useEffect(() => {
    if (!mobileOpen || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const trap = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', trap);
    first.focus();
    return () => window.removeEventListener('keydown', trap);
  }, [mobileOpen]);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col glass-panel md:hidden',
          'w-[min(280px,85vw)]',
          'transition-transform',
          mobileOpen ? 'translate-x-0 duration-300' : '-translate-x-full duration-250'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--glass-border)] shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-[var(--accent)] flex items-center justify-center">
              <GitPullRequest className="h-4 w-4 text-[var(--accent-fg)]" aria-hidden="true" />
            </div>
            <span className="font-semibold text-sm text-[var(--text)]">PR Reviewer</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
              'text-[var(--text-muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--text)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent)]'
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-[var(--glass-border)] p-2">
          <AdminMenu collapsed={false} side="top" />
        </div>
      </div>
    </>
  );
}

function Sidebar(): React.ReactElement {
  return (
    <>
      <DesktopSidebar />
      <MobileDrawer />
    </>
  );
}

export { Sidebar, SidebarProvider, useSidebar };
