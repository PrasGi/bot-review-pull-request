ErrorState is a red-edged alert slab with the error, the reason and an optional Retry.

## When to use
Failed SWR loads (dashboard, usage, table rows). Shakes once.

## What you provide
`title`, `message`, `onRetry`.

## Notes
Show the server's message; don't invent one.

Hand-written brutalist rebuild of `app/(dashboard)/page.tsx`.
