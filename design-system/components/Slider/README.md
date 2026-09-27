Slider is a fully custom range control, with no native `<input type=range>`. It has a ruled ink track, an `accent` fill and a square thumb that turns highlight and swells while dragged.

## When to use
Numeric limits with a sensible range: max chunks, temperature, rate limits. The live value shows in mono next to the label.

## What you provide
- `label`, `min`, `max`, `step`.
- `value` / `defaultValue`: a number, or a one-item array like the repo's Radix slider.
- `onValueChange`, `format(v)` for the readout, `disabled`, `aria-label` when there is no label.

Pointer drag anywhere on the track. Keyboard: ←/→/↑/↓ step, PageUp/PageDown move 10%, Home/End jump. `role="slider"` with aria values.

## Notes
Single thumb only (the repo never used ranges).

Hand-written brutalist rebuild of `components/ui/Slider.tsx`.
