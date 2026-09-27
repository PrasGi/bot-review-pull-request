Dialog is a modal slab that slams in with a slight tilt, traps focus and closes on Escape or backdrop click.

## When to use
Repo configuration and any focused edit that shouldn't leave the page.

## What you provide
`open`, `onOpenChange(bool)`, `title`, `description`, children (body and actions — wrap buttons in `.prr-dialog-actions`), `showClose` (default true), `role`. Portals to body.

## Notes
Keep one dialog at a time.

Hand-written brutalist rebuild of `components/ui/Dialog.tsx` (repo used Radix/Tailwind); same props where they overlap.
