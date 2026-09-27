Select is a fully custom listbox. There is no native `<select>`, so the dropdown looks the same in every browser. It has a square field, an ink caret tile that flips when open, and a menu that drops in with rows that flash marker-yellow.

## When to use
Provider, model, personality, status filter, period and group-by pickers: short fixed lists.

## What you provide
- `options: {value, label, disabled?}[]`, `value` / `defaultValue`.
- `onChange(e)` (e.target.value, the same shape the repo code reads) and/or `onValueChange(value)`.
- `placeholder`, `name` (renders a hidden input for forms), `label`, `hint`, `error`, `disabled`, `aria-label`, `defaultOpen`.

Keyboard: ↓/↑/Enter/Space open it, arrows move, Home/End jump, typing letters jumps to a match, Enter/Space picks, Esc/Tab closes. The ARIA combobox and listbox roles are wired in.

## Notes
For more than ~12 options, add search (not built in yet).

Hand-written brutalist rebuild of `components/ui/Select.tsx`. The repo used a native select; this one is custom at the owner's request.
