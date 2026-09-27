LineChart is an SVG line with square points that draws itself in; hover shows the value.

## When to use
AI Usage cost over time.

## What you provide
`data: {label, value}[]`, `tone`, `height`, `format(v)`, `seriesLabel`, `ariaLabel`. X labels thin out automatically.

## Notes
One series only; compare series with BarChart.

Hand-written brutalist rebuild of `app/(dashboard)/usage/page.tsx`.
