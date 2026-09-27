Toaster shows stacked notifications that slide in from the right; `toast.*()` pushes them.

## When to use
Mount `<Toaster/>` once at the app root (also exported as `AppToaster`). Call `toast.success|error|warning|info(message, description?, {duration?})`, `toast.loading(message)` and `toast.dismiss(id?)` — the same API as the repo's sonner wrapper.

## What you provide
Each toast carries a glyph (✓ ✕ ! i) on a status-colored square, a bold title and a muted description. Auto-dismiss after 4s (loading stays).

## Notes
One toast per event; don't toast what's already visible on screen.

Hand-written brutalist rebuild of `components/ui/Toast.tsx` (repo used Radix/Tailwind); same props where they overlap.
