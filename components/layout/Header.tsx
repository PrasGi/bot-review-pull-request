'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { ThemeToggle } from './ThemeToggle';
import { useSidebar } from './Sidebar';

type HeaderProps = {
  title?: React.ReactNode;
};

function Header({ title }: HeaderProps): React.ReactElement {
  const { setMobileOpen } = useSidebar();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 px-6',
        'glass-panel rounded-none border-x-0 border-t-0'
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="md:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="text-sm font-semibold text-[var(--text)] truncate">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Tooltip content="System healthy">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-default"
            role="status"
            aria-label="System status: healthy"
          >
            <span
              className="h-2 w-2 rounded-full bg-[oklch(0.70_0.15_142)] shadow-[0_0_0_2px_oklch(0.70_0.15_142/0.2)]"
              aria-hidden="true"
            />
            <span className="text-xs text-[var(--text-muted)] hidden sm:inline">Healthy</span>
          </div>
        </Tooltip>
      </div>
    </header>
  );
}

export { Header };
export type { HeaderProps };
