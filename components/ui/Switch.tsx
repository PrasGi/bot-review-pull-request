'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { useFieldId } from './Field';

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ label, checked, defaultChecked = false, onCheckedChange, className, id, ...props }, ref) => {
    const switchId = useFieldId(id, label);
    const controlled = checked !== undefined;
    const [inner, setInner] = React.useState(defaultChecked);
    const on = controlled ? checked : inner;

    return (
      <div className="prr-switch-row">
        <button
          ref={ref}
          id={switchId}
          type="button"
          role="switch"
          aria-checked={on}
          className={cn('prr-switch', className)}
          onClick={() => {
            if (!controlled) setInner(!on);
            onCheckedChange?.(!on);
          }}
          {...props}
        />
        {label && (
          <label htmlFor={switchId} className="prr-switch-label">
            {label}
          </label>
        )}
      </div>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
export type { SwitchProps };
