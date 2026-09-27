Input is the labelled text field with a hint or error line underneath.

## When to use
Every settings field and the login form. Focus pops the field up-left with a hard shadow; an error shakes in once.

## What you provide
`label`, `hint`, `error` (turns border and shadow `error-text`, sets aria-invalid and aria-describedby), `containerClassName`, plus every native input prop. `id` defaults to the slugged label.

## Notes
Always give a label. Write errors as the fix ("At least 16 characters."), not the fault.

Hand-written brutalist rebuild of `components/ui/Input.tsx` (repo used Radix/Tailwind); same props where they overlap.
