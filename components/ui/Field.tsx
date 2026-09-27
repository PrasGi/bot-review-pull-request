import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

function slug(value: string | undefined): string | undefined {
  return value ? value.toLowerCase().replace(/\s+/g, '-') : undefined;
}

/** Stable id for a control: the explicit id, else one derived from the label, else a generated one. */
function useFieldId(id: string | undefined, label: string | undefined): string {
  const auto = React.useId();
  return id ?? slug(label) ?? auto;
}

type FieldShellProps = FieldProps & {
  fieldId: string;
  /** Renders the control, given the id of the element that describes it (error or hint). */
  children: (describedBy: string | undefined) => React.ReactNode;
};

/** Label, control, then either the error or the hint, wired together for assistive tech. */
function FieldShell({ fieldId, label, hint, error, containerClassName, children }: FieldShellProps): React.ReactElement {
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  return (
    <div className={cn('prr-fieldset', containerClassName)}>
      {label && (
        <label htmlFor={fieldId} className="prr-label">
          {label}
        </label>
      )}
      {children(error ? errorId : hint ? hintId : undefined)}
      {error ? (
        <p key={error} id={errorId} className="prr-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="prr-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Forwards a ref while also keeping a local handle to the same element. */
function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export { FieldShell, useFieldId, assignRef };
export type { FieldProps };
