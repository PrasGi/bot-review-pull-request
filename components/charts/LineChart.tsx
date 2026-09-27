'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { ChartTip, useWidth, type Tip } from './ChartParts';
import { TONE, niceMax, type ChartTone } from './tones';

type LineDatum = { label: string; value: number };

type LineChartProps = {
  data: LineDatum[];
  tone?: ChartTone;
  height?: number;
  format?: (value: number) => string;
  seriesLabel?: string;
  ariaLabel: string;
};

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

function LineChart({ data, tone = 'accent', height = 240, format = String, seriesLabel = 'Value', ariaLabel }: LineChartProps): React.ReactElement {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [tip, setTip] = React.useState<Tip | null>(null);
  const color = TONE[tone];
  const H = height;
  const padL = 48;
  const padB = 24;
  const padT = 10;
  const iw = Math.max(10, W - padL - 10);
  const ih = H - padB - padT;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const step = data.length > 1 ? iw / (data.length - 1) : 0;
  const points = data.map((d, i) => [padL + i * step, padT + ih - ih * (d.value / max)] as const);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(iw / 56)));

  return (
    <div className="prr-chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={ariaLabel} onMouseLeave={() => setTip(null)}>
        {TICKS.map((k) => {
          const y = padT + ih - ih * k;
          return (
            <g key={k}>
              <line x1={padL} x2={W - 10} y1={y} y2={y} className={k ? 'prr-grid' : 'prr-axis'} />
              <text x={padL - 6} y={y + 4} className="prr-tick" textAnchor="end">
                {format(max * k)}
              </text>
            </g>
          );
        })}
        {points.length > 0 && (
          <polyline
            points={points.map((p) => p.join(',')).join(' ')}
            className="prr-line"
            style={{ stroke: color }}
            pathLength={1}
          />
        )}
        {points.map(([x, y], i) => {
          const d = data[i];
          if (!d) return null;
          return (
            <g
              key={`${d.label}-${i}`}
              onMouseEnter={() =>
                setTip({
                  x: Math.min(W - 150, x + 8),
                  y: Math.max(0, y - 56),
                  title: d.label,
                  rows: [{ label: seriesLabel, value: format(d.value), color }],
                })
              }
            >
              <rect x={x - step / 2} y={padT} width={Math.max(step, 12)} height={ih} className="prr-bar-hit" />
              <rect x={x - 4} y={y - 4} width={8} height={8} className={cn('prr-point', tip?.title === d.label && 'is-on')} />
              {i % labelEvery === 0 && (
                <text x={x} y={H - 6} className="prr-tick" textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartTip tip={tip} />
    </div>
  );
}

export { LineChart };
export type { LineChartProps, LineDatum };
