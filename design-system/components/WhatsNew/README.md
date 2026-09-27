WhatsNew is the bell in the header; a yellow square marks unread updates and the popover lists the changelog.

## When to use
Feed it `lib/changelog.ts` entries. Opening it marks the latest version seen (`onSeen` lets you persist that).

## What you provide
`entries: {version, date, title, changes[]}[]` (newest first), `unread`, `onSeen`, `subtitle`, `defaultOpen`.

## Notes
Changes are one sentence each, past or present tense, no marketing.

Hand-written brutalist rebuild of `components/layout/WhatsNew.tsx`.
