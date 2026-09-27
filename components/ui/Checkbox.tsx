import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: React.ReactNode;
};

/** A drawn box over a visually hidden native checkbox, which stays for forms and assistive tech. */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ label, className, children, ...props }, ref) => (
  <label className={cn('prr-check', className)}>
    <input ref={ref} type="checkbox" {...props} />
    <span className="prr-box" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d="M2.5 8.5l3.5 3.5 7.5-8" strokeLinecap="square" />
      </svg>
    </span>
    {(label ?? children) && <span>{label ?? children}</span>}
  </label>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
export type { CheckboxProps };
