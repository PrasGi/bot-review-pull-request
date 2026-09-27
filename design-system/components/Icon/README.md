Icon is the kit's own set of square-capped line glyphs on a 24px grid.

## When to use
Anywhere a lucide icon appears in the app, when you want zero dependencies. The app itself uses lucide-react; these are simplified stand-ins, not copies.

## What you provide
`name` (see `PRR.ICON_NAMES`), `size` (default 16), `strokeWidth` (default 2.5), `label` (makes it an img with a name; otherwise aria-hidden).

## Notes
Icon-only buttons still need `aria-label`.

Composition pattern extracted from the dashboard pages.
