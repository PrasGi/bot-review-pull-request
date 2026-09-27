'use client';

import * as React from 'react';
import { ChartLegend, ChartTip, useSvgId, useWidth, type Tip } from './ChartParts';
import { TONE, niceMax, type ChartTone } from './tones';

type BarSeries = { key: string; label: string; tone: ChartTone; hatch?: boolean };
type BarDatum = { label: string } & Record<string, number | string>;

type BarChartProps = {
  data: BarDatum[];
  series: BarSeries[];
  height?: number;
  format?: (value: number) => string;
  legend?: boolean;
  ariaLabel: string;
};

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

function valueOf(d: BarDatum, key: string): number {
  const v = d[key];
  return typeof v === 'number' ? v : 0;
}

/** Grouped bars. A hatched series reads without color (use it for failures). */
function BarChart({ data, series, height = 240, format = String, legend = true, ariaLabel }: BarChartProps): React.ReactElement {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [tip, setTip] = React.useState<Tip | null>(null);
  const id = useSvgId('bc');
  const H = height;
  const padL = 36;
  const padB = 24;
  const padT = 8;
  const iw = Math.max(10, W - padL - 4);
  const ih = H - padB - padT;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => valueOf(d, s.key)))));
  const bw = iw / Math.max(1, data.length);
  const gap = Math.max(4, bw * 0.22);
  const sw = (bw - gap) / Math.max(1, series.length);

  return (
    <div className="prr-chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={ariaLabel} onMouseLeave={() => setTip(null)}>
        <defs>
          <pattern id={`${id}h`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={6} height={6} className="prr-hatch-bg" />
            <rect width={2.5} height={6} className="prr-hatch-ink" />
          </pattern>
        </defs>
        {TICKS.map((k) => {
          const y = padT + ih - ih * k;
          return (
            <g key={k}>
              <line x1={padL} x2={W - 4} y1={y} y2={y} className={k ? 'prr-grid' : 'prr-axis'} />
              <text x={padL - 6} y={y + 4} className="prr-tick" textAnchor="end">
                {format(max * k)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x0 = padL + i * bw + gap / 2;
          return (
            <g
              key={`${d.label}-${i}`}
              onMouseEnter={() =>
                setTip({
                  x: Math.min(W - 150, x0 + bw),
                  y: 8,
                  title: d.label,
                  rows: series.map((s) => ({ label: s.label, value: format(valueOf(d, s.key)), color: TONE[s.tone] })),
                })
              }
            >
              <rect x={padL + i * bw} y={padT} width={bw} height={ih} className="prr-bar-hit" />
              {series.map((s, j) => {
                const bh = ih * (valueOf(d, s.key) / max);
                return (
                  <rect
                    key={s.key}
                    x={x0 + j * sw}
                    y={padT + ih - bh}
                    width={Math.max(1, sw - 2)}
                    height={bh}
                    className="prr-bar"
                    style={{ fill: s.hatch ? `url(#${id}h)` : TONE[s.tone], animationDelay: `${i * 30}ms` }}
                  />
                );
              })}
              <text x={padL + i * bw + bw / 2} y={H - 6} className="prr-tick" textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTip tip={tip} />
      {legend && <ChartLegend items={series} />}
    </div>
  );
}

export { BarChart };
export type { BarChartProps, BarSeries, BarDatum };
