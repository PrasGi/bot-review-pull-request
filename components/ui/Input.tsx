'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/ui/cn';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, id, containerClassName, ...props },
    ref
  ): React.ReactElement => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = inputId ? `${inputId}-error` : undefined;
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--text)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={cn(
            'glass-btn flex h-10 w-full px-3 py-2 text-sm text-[var(--text)]',
            'placeholder:text-[var(--text-muted)]',
            'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-shadow',
            error && 'outline outline-2 outline-[oklch(0.60_0.20_25)]',
            className
          )}
          {...props}
        />
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
Input.displayName = 'Input';

type PasswordInputProps = Omit<InputProps, 'type'>;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, containerClassName, ...props }, ref): React.ReactElement => {
    const [visible, setVisible] = React.useState(false);
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = inputId ? `${inputId}-error` : undefined;
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--text)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={!!error}
            className={cn(
              'glass-btn flex h-10 w-full px-3 py-2 pr-10 text-sm text-[var(--text)]',
              'placeholder:text-[var(--text-muted)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-0',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-shadow',
              error && 'outline outline-2 outline-[oklch(0.60_0.20_25)]',
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded',
              'text-[var(--text-muted)] hover:text-[var(--text)] transition-colors',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent)]'
            )}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
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
PasswordInput.displayName = 'PasswordInput';

export { Input, PasswordInput };
export type { InputProps, PasswordInputProps };
