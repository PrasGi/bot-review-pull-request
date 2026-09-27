Skeleton is a striped placeholder bar whose hatching marches while data loads.

## When to use
Stat cards and tables on first load (SWR pending).

## What you provide
Size it with `style` / `className` (width, height); aria-hidden.

## Notes
Match the shape of what's coming — don't show a skeleton for under ~300ms.

Hand-written brutalist rebuild of `components/ui/Skeleton.tsx` (repo used Radix/Tailwind); same props where they overlap.
