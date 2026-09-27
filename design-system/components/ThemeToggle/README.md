ThemeToggle is a ghost icon button that flips light/dark with a spin-in glyph.

## When to use
In the Header and the admin menu. Uncontrolled it sets `data-theme` on `<html>`; in the app pass `theme` + `onThemeChange` from next-themes.

## What you provide
`theme` ('light' | 'dark'), `onThemeChange(next)`, `tooltipSide`.

## Notes
Keep exactly one visible per screen besides the admin menu.

Hand-written brutalist rebuild of `components/layout/ThemeToggle.tsx`.
