@AGENTS.md

## Design system (PR Reviewer brutalist kit)

- The reference lives in `design-system/`. Read `design-system/README.md` and `design-system/components/*/README.md` before building UI. `design-system/components/bundle.js` is the source the React components were ported from; it is not loaded by the app.
- Tokens and component CSS are vendored in `styles/prr/` and imported once by `app/globals.css`. Do not edit them; override in a CSS Module next to the page or component.
- Build UI from `components/*` only:
  - `ui/`: controls and primitives
  - `layout/`: the shell, `PageHeader`, `SectionHeading`, `Grid`/`Stack`
  - `dashboard/`, `data/`, `charts/`, `review/`, `projects/`, `auth/`: the kit's composites
  - If a component is missing, port it from the bundle into `components/` rather than inventing markup.
- Styling:
  - CSS Modules plus tokens (`var(--space-4)`, `var(--accent)`, …) only.
  - No Tailwind, no CSS-in-JS, no new UI libraries.
  - Never hard-code colors, radii, shadows or spacing.
- No native control UI shows through. Select, slider, checkbox, radio and switch are drawn by the kit.
- Icons come from `components/ui/Icon.tsx` (the kit's set). Don't mix in another icon library. New glyphs follow the same 24px grid, square caps and 2.5 stroke.
- Layout and tone:
  - One primary (accent) action per view.
  - Status is never color alone: pair every tone with a word or glyph (✓ ✕ ! i).
  - State → tone mapping is in `lib/ui/tones.ts`. Use it rather than re-deriving.
- Every data view shows a `Skeleton` while loading, an `EmptyState` that says what will fill it, and an `ErrorState` with Retry on failure.
- Copy:
  - Sentence case everywhere.
  - Verdicts stay literal (`APPROVE`, `REQUEST_CHANGES`, `COMMENT`).
  - Slugs, SHAs, tokens and costs go in `code`.
- Theme: `next-themes` writes `data-theme` on `<html>`, and the tokens key off `[data-theme=dark]`.
