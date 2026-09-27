Header is the 64px sticky bar: page title, then What's new, theme toggle and system status on the right.

## When to use
Used by AppShell. `actions` slot for page-level buttons (Export CSV).

## What you provide
`title`, `onMenuClick` (mobile menu button, shown under 768px), `changelog` (entries, or `false` to hide the bell), `unread`, `status`, `theme` / `onThemeChange`, `actions`.

## Notes
Don't put navigation in the header.

Hand-written brutalist rebuild of `components/layout/Header.tsx`.
