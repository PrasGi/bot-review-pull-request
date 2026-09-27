'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { ChartLegend } from './ChartParts';
import { TONE, type ChartTone } from './tones';

type DonutDatum = { label: string; value: number; tone: ChartTone };

type DonutChartProps = {
  data: DonutDatum[];
  size?: number;
  centerLabel?: string;
  centerValue?: React.ReactNode;
  ariaLabel: string;
};

function DonutChart({ data, size = 200, centerLabel = 'total', centerValue, ariaLabel }: DonutChartProps): React.ReactElement {
  const [hover, setHover] = React.useState<number | null>(null);
  const sum = data.reduce((acc, d) => acc + d.value, 0);
  const total = sum || 1;
  const S = size;
  const r = S / 2 - 18;
  const C = 2 * Math.PI * r;
  const hovered = hover !== null ? data[hover] : undefined;

  const segments = data.reduce<{ d: DonutDatum; len: number; off: number }[]>((acc, d) => {
    const prev = acc[acc.length - 1];
    const off = prev ? prev.off + prev.len : 0;
    return [...acc, { d, len: (C * d.value) / total, off }];
  }, []);

  return (
    <div className="prr-donut">
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="img" aria-label={ariaLabel}>
        <circle cx={S / 2} cy={S / 2} r={r} className="prr-donut-track" />
        {segments.map(({ d, len, off }, i) => (
          <circle
            key={d.label}
            cx={S / 2}
            cy={S / 2}
            r={r}
            className={cn('prr-donut-seg', hover === i && 'is-on')}
            style={{
              stroke: TONE[d.tone],
              strokeDasharray: `${Math.max(0, len - 3)} ${C}`,
              strokeDashoffset: -off,
              animationDelay: `${i * 60}ms`,
            }}
            transform={`rotate(-90 ${S / 2} ${S / 2})`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={S / 2} y={S / 2 - 2} textAnchor="middle" className="prr-donut-num">
          {hovered ? hovered.value : (centerValue ?? sum)}
        </text>
        <text x={S / 2} y={S / 2 + 18} textAnchor="middle" className="prr-donut-cap">
          {hovered ? hovered.label : centerLabel}
        </text>
      </svg>
      <ChartLegend
        items={data.map((d) => ({ label: d.label, tone: d.tone, value: `${Math.round((d.value / total) * 100)}%` }))}
      />
    </div>
  );
}

export { DonutChart };
export type { DonutChartProps, DonutDatum };
