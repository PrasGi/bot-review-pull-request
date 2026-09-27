Button is the clickable slab for every action: square, 3px ink edge, hard 4px shadow that lifts on hover and slams flat on press.

## When to use
Use `primary` (accent fill) for the one main action per view, `secondary` for everything else, `destructive` for disconnect/delete, `ghost` for cancel and toolbar actions.

## What you provide
`variant`: primary · secondary · destructive · ghost (default primary). `size`: sm (32px) · md (40px) · icon (36×36; give it `aria-label`). `loading` shows a stepped square spinner and disables the button. Accepts every native `<button>` prop; `type` defaults to `button`.

## Notes
Don't put two primary buttons side by side. Don't wrap icons-only buttons without `aria-label`.

Hand-written brutalist rebuild of `components/ui/Button.tsx` (repo used Radix/Tailwind); same props where they overlap.
