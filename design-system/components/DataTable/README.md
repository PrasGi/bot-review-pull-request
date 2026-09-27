DataTable is the ink-headed table card with a filter toolbar, loading skeleton rows, empty and error states, and a footer slot.

## When to use
Review requests, usage breakdown, model pricing. Rows tint `accent-subtle` on hover.

## What you provide
`columns: {key, header, render?(row), align?, mono?, muted?, width?}[]`, `rows`, `rowKey`, `loading`, `skeletonRows`, `error` (message) + `onRetry`, `empty: {title, description}`, `toolbar` (Select/Input filters), `footer` (Pagination), `onRowClick`, `caption`.

## Notes
Numbers right-aligned and `mono`. Keep status and verdict as Badges.

Hand-written brutalist rebuild of `app/(dashboard)/requests/page.tsx`.
