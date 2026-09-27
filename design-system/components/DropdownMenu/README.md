DropdownMenu drops a square list of actions under a trigger; rows flash marker-yellow and nudge right on hover.

## When to use
Account menus, per-row overflow (⋮) actions.

## What you provide
`trigger` (a Button element), `align`: start · end, `defaultOpen`, children: `DropdownMenuItem` (`onSelect`, `destructive`, `disabled`), `DropdownMenuLabel`, `DropdownMenuSeparator`. Arrow keys move, Escape closes and returns focus.

## Notes
Put destructive items last, after a separator.

Hand-written brutalist rebuild of `components/ui/DropdownMenu.tsx` (repo used Radix/Tailwind); same props where they overlap.
