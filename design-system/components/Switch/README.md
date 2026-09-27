Switch is a square toggle whose block snaps across with a little overshoot.

## When to use
Settings that take effect immediately (auto-review on push, re-review on reply).

## What you provide
`label`, `checked` / `defaultChecked`, `onCheckedChange(bool)`, `disabled`. Renders `role="switch"` with aria-checked.

## Notes
Don't use inside a form that needs a Save button — use Checkbox.

Hand-written brutalist rebuild of `components/ui/Switch.tsx` (repo used Radix/Tailwind); same props where they overlap.
