AccountCard is a connected GitHub account: avatar, name, @login, repo count, Re-sync, and chips for each installation.

## When to use
Projects → Connected accounts.

## What you provide
`displayName`, `login`, `avatarUrl`, `repoCount`, `reconnectRequired`, `syncing`, `onResync`, `installations: {login, type: 'User' | 'Organization', href}[]`.

## Notes
Toast the re-sync result.

Hand-written brutalist rebuild of `app/(dashboard)/projects/page.tsx`.
