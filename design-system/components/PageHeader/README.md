PageHeader is the big h1 block at the top of a page, with optional back button, kicker, status badge and actions.

## When to use
Every page: Review Requests, AI Usage, Projects, Settings; request detail uses `onBack` + `kicker` (repo) + `badge` (status).

## What you provide
`title`, `description`, `kicker`, `badge`, `actions` (right side, bottom-aligned for filter selects), `onBack` + `backLabel`.

## Notes
One per page. Description is one sentence.

Composition pattern extracted from the dashboard pages.
