RepoGroup is an ink-headed list of RepoRow items for one account; RepoRow is a repo with enable Switch and Configure.

## When to use
Projects → Repositories, grouped by account login.

## What you provide
RepoGroup: `title`, `count`, children. RepoRow: `fullName`, `enabled` / `defaultEnabled`, `onEnabledChange`, `toggling`, `lastEventAt`, `removed`, `onConfigure` (open the repo config Dialog).

## Notes
Removed repos stay listed, struck through, controls disabled.

Hand-written brutalist rebuild of `app/(dashboard)/projects/page.tsx`.
