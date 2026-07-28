'use client';

import * as React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/ui/cn';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: RadixTooltip.TooltipContentProps['side'];
  align?: RadixTooltip.TooltipContentProps['align'];
  delayDuration?: number;
  className?: string;
};

function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 150,
  className,
}: TooltipProps): React.ReactElement {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={6}
            className={cn(
              'glass-panel px-3 py-1.5 text-xs text-[var(--text)] shadow-lg',
              'z-50 max-w-[200px] select-none leading-snug',
              'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
              'data-[state=delayed-open]:fade-in-0 data-[state=closed]:fade-out-0',
              'data-[state=delayed-open]:zoom-in-95 data-[state=closed]:zoom-out-95',
              'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
              className
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-[var(--glass-border)]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

export { Tooltip };
export type { TooltipProps };
