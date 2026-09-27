'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Card } from '@/components/ui/Card';
import { TONE, type ChartTone } from './tones';

type LegendItem = { label: string; tone: ChartTone; value?: React.ReactNode; hatch?: boolean };

function ChartLegend({ items }: { items: LegendItem[] }): React.ReactElement {
  return (
    <ul className="prr-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className={cn('prr-legend-sw', item.hatch && 'is-hatch')} style={{ background: TONE[item.tone] }} />
          {item.label}
          {item.value !== undefined && <b>{item.value}</b>}
        </li>
      ))}
    </ul>
  );
}

type Tip = { x: number; y: number; title: string; rows: { label: string; value: string; color: string }[] };

function ChartTip({ tip }: { tip: Tip | null }): React.ReactElement | null {
  if (!tip) return null;
  return (
    <div className="prr-chart-tip" style={{ left: tip.x, top: tip.y }}>
      <p className="prr-chart-tip-title">{tip.title}</p>
      {tip.rows.map((row) => (
        <p key={row.label}>
          <span className="prr-legend-sw" style={{ background: row.color }} />
          {row.label}
          <b>{row.value}</b>
        </p>
      ))}
    </div>
  );
}

/** Tracks an element's width so SVG charts can lay out in real pixels. */
function useWidth<T extends HTMLElement>(fallback = 480): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(fallback);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.clientWidth) setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** An SVG-safe id (React ids contain characters that break `url(#…)`). */
function useSvgId(prefix: string): string {
  return prefix + React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

type ChartCardProps = { title: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string };

function ChartCard({ title, actions, children, className }: ChartCardProps): React.ReactElement {
  return (
    <Card className={cn('prr-chart-card', className)}>
      <div className="prr-chart-card-head">
        <h2 className="prr-section-title">{title}</h2>
        {actions}
      </div>
      {children}
    </Card>
  );
}

export { ChartLegend, ChartTip, ChartCard, useWidth, useSvgId };
export type { LegendItem, Tip };
