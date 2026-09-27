FindingCard is one AI review finding: severity + category badges, file:line, the comment, an optional suggestion block and blocking/posted flags.

## When to use
Request detail findings list. Shadow color follows severity (critical/major → error, minor → warning, else ink).

## What you provide
`severity` (critical · major · minor · nit), `category`, `location` ('path:line–end'), `comment`, `suggestion`, `blocking`, `posted`.

## Notes
Sort by severity, most severe first.

Hand-written brutalist rebuild of `app/(dashboard)/requests/[id]/page.tsx`.
