'use client';

import * as React from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/ui/cn';

type SwitchProps = RadixSwitch.SwitchProps & {
  label?: string;
};

const Switch = React.forwardRef<
  React.ComponentRef<typeof RadixSwitch.Root>,
  SwitchProps
>(({ className, label, id, ...props }, ref): React.ReactElement => {
  const switchId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex items-center gap-2">
      <RadixSwitch.Root
        ref={ref}
        id={switchId}
        className={cn(
          'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=unchecked]:bg-[var(--nav-hover)] data-[state=checked]:bg-[var(--accent)]',
          className
        )}
        {...props}
      >
        <RadixSwitch.Thumb
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0',
            'transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4'
          )}
        />
      </RadixSwitch.Root>
      {label && (
        <label
          htmlFor={switchId}
          className="text-sm text-[var(--text)] cursor-pointer select-none"
        >
          {label}
        </label>
      )}
    </div>
  );
});
Switch.displayName = 'Switch';

export { Switch };
export type { SwitchProps };
