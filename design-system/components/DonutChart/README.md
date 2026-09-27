DonutChart is an SVG ring with the total in the middle and a percentage legend; hovering a segment thickens it and swaps the center readout.

## When to use
Verdict distribution.

## What you provide
`data: {label, value, tone}[]`, `size` (default 200), `centerLabel`, `centerValue`, `ariaLabel`.

## Notes
Three to five segments. Legend always shows percentages.

Hand-written brutalist rebuild of `app/(dashboard)/page.tsx`.
