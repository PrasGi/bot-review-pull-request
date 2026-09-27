'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { useFieldId } from './Field';

type SliderProps = {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  /** One-item arrays, like the Radix slider this replaces. */
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  format?: (value: number) => React.ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
};

/** A drawn track and thumb; there is no native range input. */
function Slider({
  label,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  format,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
}: SliderProps): React.ReactElement {
  const fieldId = useFieldId(id, label);
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue?.[0] ?? min);
  const current = controlled ? (value[0] ?? min) : inner;
  const [dragging, setDragging] = React.useState(false);
  const track = React.useRef<HTMLDivElement>(null);
  const thumb = React.useRef<HTMLSpanElement>(null);
  const pct = ((current - min) / (max - min || 1)) * 100;

  const commit = (raw: number): void => {
    const snapped = Math.round((raw - min) / step) * step + min;
    const next = Number(Math.min(max, Math.max(min, snapped)).toFixed(6));
    if (next === current) return;
    if (!controlled) setInner(next);
    onValueChange?.([next]);
  };

  const fromX = (x: number): void => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    commit(min + (Math.min(Math.max(0, x - r.left), r.width) / (r.width || 1)) * (max - min));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    e.preventDefault();
    fromX(e.clientX);
    setDragging(true);
    thumb.current?.focus();
    const onMove = (ev: PointerEvent): void => fromX(ev.clientX);
    const onUp = (): void => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>): void => {
    const big = Math.max(step, (max - min) / 10);
    const deltas: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: big,
      PageDown: -big,
    };
    const delta = deltas[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      commit(current + delta);
    } else if (e.key === 'Home') {
      e.preventDefault();
      commit(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      commit(max);
    }
  };

  const shown = format ? format(current) : current;

  return (
    <div className={cn('prr-fieldset', className)}>
      {label && (
        <div className="prr-slider-head">
          <span id={`${fieldId}-label`} className="prr-label">
            {label}
          </span>
          <span className="prr-slider-value">{shown}</span>
        </div>
      )}
      <div
        ref={track}
        className={cn('prr-slider', dragging && 'is-dragging', disabled && 'is-disabled')}
        onPointerDown={onPointerDown}
      >
        <span className="prr-slider-track">
          <span className="prr-slider-range" style={{ width: `${pct}%` }} />
        </span>
        <span
          ref={thumb}
          id={fieldId}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          className="prr-slider-thumb"
          style={{ left: `${pct}%` }}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-valuetext={String(shown)}
          aria-disabled={disabled || undefined}
          aria-labelledby={label ? `${fieldId}-label` : undefined}
          aria-label={label ? undefined : ariaLabel}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}

export { Slider };
export type { SliderProps };
