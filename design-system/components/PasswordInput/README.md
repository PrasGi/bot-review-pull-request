PasswordInput is an Input with a SHOW/HIDE toggle for secrets.

## When to use
Login password, API keys, webhook secrets.

## What you provide
Same props as Input except `type`. The toggle is a text button with an aria-label.

## Notes
Never prefill a real secret.

Hand-written brutalist rebuild of `components/ui/Input.tsx` (repo used Radix/Tailwind); same props where they overlap.
