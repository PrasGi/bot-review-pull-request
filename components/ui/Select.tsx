'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { FieldShell, assignRef, useFieldId, type FieldProps } from './Field';

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

/** Shaped like a native change event so `e.target.value` keeps working at call sites. */
type SelectChangeEvent = {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
};

type SelectProps = FieldProps & {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
  onChange?: (e: SelectChangeEvent) => void;
  onValueChange?: (value: string) => void;
};

/** A custom listbox: no native `<select>` UI shows through. With `name`, a hidden input carries the value in forms. */
const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      placeholder,
      name,
      disabled,
      id,
      className,
      label,
      hint,
      error,
      containerClassName,
      onChange,
      onValueChange,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const fieldId = useFieldId(id, label);
    const listId = `${fieldId}-list`;
    const controlled = value !== undefined;
    const [inner, setInner] = React.useState<string | undefined>(
      defaultValue ?? (placeholder ? '' : options[0]?.value)
    );
    const current = controlled ? value : inner;
    const selected = options.find((o) => o.value === current) ?? null;

    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState(-1);
    const wrap = React.useRef<HTMLDivElement>(null);
    const button = React.useRef<HTMLButtonElement | null>(null);
    const list = React.useRef<HTMLUListElement>(null);
    const typed = React.useRef({ query: '', at: 0 });

    const openList = (): void => {
      if (disabled) return;
      const index = selected ? options.indexOf(selected) : -1;
      setActive(index < 0 ? 0 : index);
      setOpen(true);
    };

    const pick = (option: SelectOption | undefined): void => {
      if (!option || option.disabled) return;
      if (!controlled) setInner(option.value);
      const target = { value: option.value, name };
      onChange?.({ target, currentTarget: target });
      onValueChange?.(option.value);
      setOpen(false);
      button.current?.focus();
    };

    const move = (delta: number): void => {
      const n = options.length;
      if (!n) return;
      let i = active;
      for (let k = 0; k < n; k++) {
        i = (i + delta + n) % n;
        if (!options[i]?.disabled) break;
      }
      setActive(i);
    };

    React.useEffect(() => {
      if (!open) return;
      const onPointerDown = (e: MouseEvent): void => {
        if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', onPointerDown);
      return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    React.useEffect(() => {
      if (!open || !list.current) return;
      list.current.children[active]?.scrollIntoView?.({ block: 'nearest' });
    }, [active, open]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
      const key = e.key;
      if (!open) {
        if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
          e.preventDefault();
          openList();
        }
        return;
      }
      if (key === 'ArrowDown') {
        e.preventDefault();
        move(1);
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
      } else if (key === 'Home') {
        e.preventDefault();
        setActive(0);
      } else if (key === 'End') {
        e.preventDefault();
        setActive(options.length - 1);
      } else if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        pick(options[active]);
      } else if (key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (key === 'Tab') {
        setOpen(false);
      } else if (key.length === 1) {
        const t = typed.current;
        const now = Date.now();
        t.query = (now - t.at > 600 ? '' : t.query) + key.toLowerCase();
        t.at = now;
        const match = options.findIndex((o) => String(o.label).toLowerCase().startsWith(t.query));
        if (match >= 0) setActive(match);
      }
    };

    return (
      <FieldShell fieldId={fieldId} label={label} hint={hint} error={error} containerClassName={containerClassName}>
        {(describedBy) => (
          <div ref={wrap} className={cn('prr-select', open && 'is-open')}>
            <button
              ref={(el) => {
                button.current = el;
                assignRef(ref, el);
              }}
              id={fieldId}
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
              aria-invalid={!!error}
              aria-describedby={describedBy}
              aria-label={ariaLabel}
              disabled={disabled}
              className={cn('prr-field prr-select-btn', !selected && 'is-placeholder', className)}
              onClick={() => (open ? setOpen(false) : openList())}
              onKeyDown={onKeyDown}
            >
              <span className="prr-select-value">{selected ? selected.label : (placeholder ?? 'Select…')}</span>
              <span className="prr-select-caret" aria-hidden="true" />
            </button>
            {name && <input type="hidden" name={name} value={current ?? ''} />}
            {open && (
              <ul ref={list} id={listId} role="listbox" className="prr-listbox" aria-labelledby={fieldId}>
                {options.map((option, i) => {
                  const isSelected = option.value === current;
                  return (
                    <li
                      key={option.value}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      className={cn(
                        'prr-option',
                        i === active && 'is-active',
                        isSelected && 'is-selected',
                        option.disabled && 'is-disabled'
                      )}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(option)}
                    >
                      <span className="prr-option-check" aria-hidden="true">
                        {isSelected ? '■' : ''}
                      </span>
                      <span>{option.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </FieldShell>
    );
  }
);
Select.displayName = 'Select';

export { Select };
export type { SelectProps, SelectOption, SelectChangeEvent };
