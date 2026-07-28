'use client';

import * as React from 'react';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/ui/cn';

const DropdownMenu = RadixDropdown.Root;
const DropdownMenuTrigger = RadixDropdown.Trigger;
const DropdownMenuGroup = RadixDropdown.Group;
const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof RadixDropdown.Separator>,
  RadixDropdown.DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <RadixDropdown.Separator
    ref={ref}
    className={cn('my-1 h-px bg-[var(--glass-border)]', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof RadixDropdown.Content>,
  RadixDropdown.DropdownMenuContentProps
>(({ className, sideOffset = 4, ...props }, ref) => (
  <RadixDropdown.Portal>
    <RadixDropdown.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'glass-panel z-50 min-w-[180px] p-1 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
        className
      )}
      {...props}
    />
  </RadixDropdown.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof RadixDropdown.Item>,
  RadixDropdown.DropdownMenuItemProps & { destructive?: boolean }
>(({ className, destructive = false, ...props }, ref) => (
  <RadixDropdown.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors',
      destructive
        ? 'text-[oklch(0.60_0.20_25)] focus:bg-[oklch(0.60_0.20_25/0.1)]'
        : 'text-[var(--text)] focus:bg-[var(--nav-hover)]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof RadixDropdown.Label>,
  RadixDropdown.DropdownMenuLabelProps
>(({ className, ...props }, ref) => (
  <RadixDropdown.Label
    ref={ref}
    className={cn('px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
