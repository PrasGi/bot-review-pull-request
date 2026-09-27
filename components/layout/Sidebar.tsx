'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/ui/cn';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { AdminMenu } from './AdminMenu';
import { BrandMark } from './Brand';

type NavItem = { label: string; href: string; icon: IconName };

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard' },
  { label: 'Requests', href: '/requests', icon: 'pr' },
  { label: 'AI Usage', href: '/usage', icon: 'chart' },
  { label: 'Projects', href: '/projects', icon: 'folder' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

function isActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
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
  const active = isActive(item.href, pathname);
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn('prr-nav-link', active && 'is-active', collapsed && 'is-collapsed')}
    >
      <Icon name={item.icon} size={18} />
      {collapsed ? <span className="prr-sr">{item.label}</span> : <span>{item.label}</span>}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

type SidebarProps = {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Drawer variant for small screens: shows a close button instead of the collapse toggle. */
  mobile?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
  className?: string;
};

function Sidebar({
  collapsed = false,
  onCollapsedChange,
  mobile = false,
  onClose,
  onNavigate,
  className,
}: SidebarProps): React.ReactElement {
  return (
    <aside
      className={cn('prr-sidebar', collapsed && 'is-collapsed', mobile && 'is-mobile', className)}
      aria-label="Main navigation"
    >
      <div className="prr-sidebar-head">
        <BrandMark compact={collapsed} />
        {mobile ? (
          <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={onClose}>
            <Icon name="x" />
          </Button>
        ) : (
          <Tooltip content={collapsed ? 'Expand (⌘B)' : 'Collapse (⌘B)'} side="right">
            <button
              type="button"
              className="prr-collapse"
              onClick={() => onCollapsedChange?.(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
            </button>
          </Tooltip>
        )}
      </div>
      <nav className="prr-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="prr-sidebar-foot">
        <AdminMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}

export { Sidebar };
