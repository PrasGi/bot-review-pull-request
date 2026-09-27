'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type RadioOption = { value: string; label: React.ReactNode; disabled?: boolean };

type RadioGroupProps = {
  label?: string;
  name?: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  className?: string;
};

function RadioGroup({
  label,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  orientation = 'vertical',
  disabled,
  className,
}: RadioGroupProps): React.ReactElement {
  const auto = React.useId();
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue);
  const current = controlled ? value : inner;

  return (
    <fieldset className={cn('prr-fieldset', className)}>
      {label && (
        <legend className="prr-label" style={{ marginBottom: 6, padding: 0 }}>
          {label}
        </legend>
      )}
      <div
        role="radiogroup"
        className={cn('prr-radio-group', orientation === 'horizontal' && 'prr-radio-group--row')}
      >
        {options.map((option) => (
          <label key={option.value} className="prr-radio">
            <input
              type="radio"
              name={name ?? auto}
              value={option.value}
              checked={current === option.value}
              disabled={disabled || option.disabled}
              onChange={() => {
                if (!controlled) setInner(option.value);
                onValueChange?.(option.value);
              }}
            />
            <span className="prr-dot" aria-hidden="true" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { RadioGroup };
export type { RadioGroupProps, RadioOption };
