BarChart is a dependency-free SVG grouped bar chart with ink-outlined bars that grow in, hover tooltip and legend.

## When to use
Reviews per day (completed vs failed). Replaces recharts' BarChart.

## What you provide
`data: {label, [key]: number}[]`, `series: {key, label, tone, hatch?}[]` (tone: accent · success · warning · error · info · highlight · ink), `height` (default 240), `format(v)`, `legend` (default true), `ariaLabel`. Responsive to its container width.

## Notes
Give the 'bad' series `hatch: true` so it reads without color. Max ~31 bars.

Hand-written brutalist rebuild of `app/(dashboard)/page.tsx`.
