'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/ui/cn';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Popover } from '@/components/ui/Popover';
import { ThemeToggle } from './ThemeToggle';

type AdminMenuProps = { collapsed?: boolean };

function AdminMenu({ collapsed = false }: AdminMenuProps): React.ReactElement {
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
    <button type="button" className={cn('prr-admin', collapsed && 'is-collapsed')} aria-label="Admin menu">
      <Avatar name="Admin" initials="AD" size={32} tone="accent" />
      {!collapsed && (
        <span className="prr-admin-text">
          <span className="prr-admin-name">Admin</span>
          <span className="prr-admin-mail">admin@example.com</span>
        </span>
      )}
      {!collapsed && <Icon name="more" />}
    </button>
  );

  return (
    <>
      <Popover
        trigger={trigger}
        side="top"
        align={collapsed ? 'start' : 'end'}
        label="Admin menu"
        wrapClassName="prr-admin-wrap"
        className="prr-admin-pop"
      >
        {(close) => (
          <>
            <div className="prr-admin-theme">
              <span className="prr-label">Theme</span>
              <ThemeToggle />
            </div>
            <div className="prr-menu-sep" role="separator" />
            <button
              type="button"
              className="prr-menu-item prr-menu-item--destructive"
              onClick={() => {
                close();
                setLogoutOpen(true);
              }}
            >
              <Icon name="logout" />
              Log out
            </button>
          </>
        )}
      </Popover>
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

export { AdminMenu };
