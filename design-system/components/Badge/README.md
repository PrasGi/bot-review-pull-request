Badge is a small uppercase mono stamp for verdicts, states and labels.

## When to use
Map verdicts: APPROVE → `success`, REQUEST_CHANGES → `error`, COMMENT → `warning`, queued/processing → `info`, personality or provider names → `accent` / `neutral`.

## What you provide
`variant`: success · warning · error · info · neutral · accent. Children = the text; start it with a glyph (✓ ✕ !) so state never relies on color.

## Notes
Keep the text to one or two words.

Hand-written brutalist rebuild of `components/ui/Badge.tsx` (repo used Radix/Tailwind); same props where they overlap.
