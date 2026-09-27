ConfirmDialog asks yes/no before an irreversible action.

## When to use
Disconnect account, delete repo config, log out.

## What you provide
`open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `cancelLabel`, `destructive`, `onConfirm`, `loading`. Uses role alertdialog.

## Notes
The confirm label repeats the verb ("Disconnect"), never "OK".

Hand-written brutalist rebuild of `components/ui/Dialog.tsx` (repo used Radix/Tailwind); same props where they overlap.
