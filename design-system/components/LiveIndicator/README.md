LiveIndicator is a pinging square with a mono caption telling the user the data auto-refreshes.

## When to use
Requests list (SWR refresh every 5s) and any live view.

## What you provide
`label` (default 'Live · updates every 5s'), `ariaLabel`.

## Notes
Only show it when the data really polls.

Hand-written brutalist rebuild of `app/(dashboard)/requests/page.tsx`.
