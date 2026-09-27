BudgetMeter shows today's spend against the cost-alert threshold on a 10-step ruler.

## When to use
Dashboard budget alert. Fill is `accent` below 80%, `warning` from 80%, hatched `error` when over, with the message underneath.

## What you provide
`spent`, `limit` (numbers), `format(v)` (default `$0.00`), `label`, `overMessage`.

## Notes
Always show both numbers; the color is backup.

Hand-written brutalist rebuild of `app/(dashboard)/page.tsx`.
