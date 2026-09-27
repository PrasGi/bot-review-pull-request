'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { FieldShell, assignRef, useFieldId, type FieldProps } from './Field';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & FieldProps;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, containerClassName, className, id, ...props }, ref) => {
    const fieldId = useFieldId(id, label);
    return (
      <FieldShell fieldId={fieldId} label={label} hint={hint} error={error} containerClassName={containerClassName}>
        {(describedBy) => (
          <input
            ref={ref}
            id={fieldId}
            className={cn('prr-field', className)}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            {...props}
          />
        )}
      </FieldShell>
    );
  }
);
Input.displayName = 'Input';

type PasswordInputProps = Omit<InputProps, 'type'>;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, hint, error, containerClassName, className, id, ...props }, ref) => {
    const fieldId = useFieldId(id, label);
    const [visible, setVisible] = React.useState(false);
    return (
      <FieldShell fieldId={fieldId} label={label} hint={hint} error={error} containerClassName={containerClassName}>
        {(describedBy) => (
          <div className="prr-pw">
            <input
              ref={ref}
              id={fieldId}
              type={visible ? 'text' : 'password'}
              className={cn('prr-field', className)}
              aria-invalid={!!error}
              aria-describedby={describedBy}
              {...props}
            />
            <button
              type="button"
              className="prr-pw-toggle"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
            >
              {visible ? 'Hide' : 'Show'}
            </button>
          </div>
        )}
      </FieldShell>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldProps & {
    minHeight?: number;
  };

/** Grows with its content; there is no resize grip. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, containerClassName, className, id, minHeight = 96, onInput, value, ...props }, ref) => {
    const fieldId = useFieldId(id, label);
    const inner = React.useRef<HTMLTextAreaElement | null>(null);

    const fit = React.useCallback(() => {
      const el = inner.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(minHeight, el.scrollHeight + 4)}px`;
    }, [minHeight]);

    React.useLayoutEffect(fit, [fit, value]);

    return (
      <FieldShell fieldId={fieldId} label={label} hint={hint} error={error} containerClassName={containerClassName}>
        {(describedBy) => (
          <textarea
            ref={(el) => {
              inner.current = el;
              assignRef(ref, el);
            }}
            id={fieldId}
            rows={3}
            className={cn('prr-field prr-textarea', className)}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            value={value}
            onInput={(e) => {
              fit();
              onInput?.(e);
            }}
            {...props}
          />
        )}
      </FieldShell>
    );
  }
);
Textarea.displayName = 'Textarea';

export { Input, PasswordInput, Textarea };
export type { InputProps, PasswordInputProps, TextareaProps };
