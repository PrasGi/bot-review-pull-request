import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, id, options, placeholder, containerClassName, ...props },
    ref
  ): React.ReactElement => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = selectId ? `${selectId}-error` : undefined;
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-[var(--text)]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={cn(
            'glass-btn flex h-10 w-full px-3 py-2 text-sm text-[var(--text)]',
            'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-shadow appearance-none',
            'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")]',
            'bg-[position:right_0.5rem_center] bg-[size:1.25rem] bg-no-repeat pr-8',
            error && 'outline outline-2 outline-[oklch(0.60_0.20_25)]',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p
            id={errorId}
            className="text-xs text-[oklch(0.60_0.20_25)]"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
export type { SelectProps, SelectOption };
