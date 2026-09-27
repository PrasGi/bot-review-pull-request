StatusDot is the header's system-health stamp: a square light plus HEALTHY / DEGRADED / DOWN.

## When to use
Header right edge; any service health readout. DOWN blinks.

## What you provide
`status`: healthy · degraded · down, `label`, `tooltip`, `hideLabel`.

## Notes
The word is the signal; never show the dot alone without a tooltip.

Hand-written brutalist rebuild of `components/layout/Header.tsx`.
