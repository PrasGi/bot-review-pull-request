Card is the white slab that holds a stat, a chart or a settings group — the brutalist replacement for GlassCard.

## When to use
Use for dashboard stats and settings sections. `hoverLift` only when the whole card is a link.

## What you provide
`kicker` (mono uppercase eyebrow), `title` (20px bold), `hoverLift` (lifts 4px with a bigger shadow), children. Also exported as `GlassCard` so repo imports keep working.

## Notes
Don't nest cards inside cards; use a `border-thin` divider instead.

Hand-written brutalist rebuild of `components/ui/GlassCard.tsx` (repo used Radix/Tailwind); same props where they overlap.
