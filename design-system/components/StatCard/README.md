StatCard is a dashboard KPI slab: mono label, icon tile, a 40px number, optional delta.

## When to use
Dashboard's four KPIs (reviews today, this week, cost this month, avg review time). Lifts on hover, icon tile tilts and turns highlight.

## What you provide
`label`, `value` (pre-formatted string), `icon` (Icon name or element), `delta` ('+12%' / '-4%'), `hint`, `loading` (skeleton), `hoverLift`.

## Notes
Four per row at most. Format numbers before passing them.

Hand-written brutalist rebuild of `app/(dashboard)/page.tsx`.
