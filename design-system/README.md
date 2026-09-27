PR Reviewer is a dashboard for an AI bot that reviews GitHub pull requests as your own account. This system is its **brutalist** skin: raw paper, black ink, square slabs, hard shadows, one electric blue. The UI should look like it was built, not polished. Everything is outlined, nothing is blurred, and every state is spelled out.

## Content fundamentals

- **Voice:** a blunt senior reviewer. Short, declarative, technical. "Review posted." "Provider timed out — retrying in 30s." No exclamation marks, no emoji in UI copy (the repo README uses them; the product UI doesn't).
- **Casing:** sentence case for titles, buttons and labels in copy ("Review draft PRs"). Field labels, badges and eyebrows are set in the `label` style, which uppercases them in CSS. Write them in normal case.
- **Verdicts are literal:** show GitHub's own words (`APPROVE`, `REQUEST_CHANGES`, `COMMENT`) in `label` or `code`. Don't soften them.
- **Numbers are data:** repo slugs, PR numbers, tokens, costs and SHAs go in `code` (Geist Mono, tabular). Write `owner/repo#128 · 4,213 tokens`.
- **Errors say the fix:** "At least 16 characters." beats "Invalid secret."

## Visual foundations

**Color.** Set pages on `bg` and put content on `surface` slabs. Draw every edge and shadow in `text` (the `border` token aliases it). Keep `accent` for the single primary action, checked controls, the slider range and the focus ring. Put `accent-fg` on accent. It flips to ink in dark, because the dark accent is lighter. `highlight` (marker yellow) is the hover and selection color and the one loud stamp per screen. Use status fills (`success`, `warning`, `error`, `info`) only as flat blocks with `on-fill` text. Pair each one with a word or glyph (✓ ✕ ! i). `success` and `error` differ in lightness, so they stay distinct without hue. Use `error-text` for error copy and invalid borders on grounds. Don't use gradients, glass, blur or background blobs. The repo's glass layer is retired.

**Type.** Geist does all the talking and Geist Mono labels it. Use `display` (56/52, 800, tight tracking, uppercase) once per screen for a hero number. Page titles are `h1`, card and dialog titles `h2`, and copy `body` (14/20). Use `body-strong` for button and emphasis text, and `small` for hints, errors and tooltips. Badges, field labels and eyebrows are `label` (mono, 700, +0.06em, uppercase). Numbers are `code`.

**Borders, radii, shadows.** All three radii (`radius-btn`, `radius-panel`, `radius-card`) are `0px`. The only round shapes are the radio dot and the text cursor. Use `border-thick` (3px) on anything you grab: buttons, cards, dialogs, menus, toasts. Use `border-thin` (2px) on fields, badges, checkboxes, switches and dividers. Shadows are hard offsets with no blur: `shadow-sm` on badges and toggles, `shadow-md` on resting buttons, cards and focused fields, `shadow-lg` on dialogs and lifted cards.

**Spacing.** The spacing follows the repo's 4px Tailwind rhythm. Use `space-1.5` from label to field, `space-2` between buttons, `space-3` and `space-4` for control padding, `space-4` between fields, `space-6` inside cards and dialogs, and `space-8` between page sections.

**Focus.** A solid 3px `accent` outline, offset 2px, on every interactive element. It holds ≥5:1 on `bg` and `surface` in both themes.

**Motion.** Motion is pure CSS, with no animation library and nothing that runs on scroll. It is physical: things lift on hover and slam down on press. The durations are `--prr-dur-fast` 90ms (press, hover, color), `--prr-dur` 160ms (toggles, menus, checkmarks) and `--prr-dur-slow` 240ms (dialog, toast, error shake). The easing is `--prr-ease` for movement and `--prr-ease-snap` (a small overshoot) for switches, radio dots, dialogs and toasts. Signature moves:
- A button lifts −2px with a 6px shadow on hover and drops +4px with no shadow on press.
- A field translates −2px and gains `shadow-md` on focus. An error message shakes once.
- A checkbox draws its check stroke, a switch block snaps across, and a radio dot pops.
- A dialog slams in from a slight tilt, a menu drops with a squash, and a toast slides in from the right.
- A skeleton's hatching marches. Spinners rotate in hard `steps()`.
- `prefers-reduced-motion` turns every one of these off.

**Layout.** Place slabs on a flat `bg` with at least `space-6` gutters so the offset shadows have room to breathe. Keep lists and tables left-aligned, divided by `border-thin` rules and never zebra-striped.

## Iconography

The app uses **lucide-react** line icons (LayoutDashboard, GitPullRequest, BarChart3, FolderGit2, Settings, Bell, Sun/Moon, RefreshCw, AlertTriangle…). The kit ships its own `Icon` set instead: simplified square-capped glyphs on a 24px grid, drawn in `currentColor` with a 2.5 stroke to match the heavy borders. `PRR.ICON_NAMES` lists them. They are stand-ins, not copies of lucide. Either set works; don't mix the two on one screen. Put icons inside a bordered square tile (`StatCard`, `AttentionItem`, `BrandMark`) rather than floating them. The repo has no logo. The app's mark is the pull-request glyph on an `accent` square (`BrandMark`) next to "PR Reviewer" set in type.

## Components

**Nothing native shows through.** Select is a custom listbox, Slider a custom track and thumb, and Textarea auto-grows without a resize grip. Checkbox, radio and switch are drawn boxes, and search-clear, number spinners and autofill tint are suppressed. Scrollbars are ink bars on `bg`. The native elements that remain underneath (hidden checkbox and radio inputs, `details` in Disclosure) exist only for accessibility and forms. None of their browser UI is visible.

Everything lives in `window.PRR` (React 18+, no other dependencies, one ~63 KB script and one stylesheet, versus roughly 400 KB for Radix plus recharts). Class names are prefixed `prr-`. The API mirrors the repo's `components/ui/*` and `components/layout/*`, so imports map one to one. `GlassCard` and `AppToaster` remain as aliases of `Card` and `Toaster`.

- **Base:** Button, Badge, Card, Input, PasswordInput, Textarea, Select, Checkbox, RadioGroup, Switch, Slider, Dialog, ConfirmDialog, DropdownMenu, Tooltip, Skeleton, Toaster.
- **Layout:** AppShell, Sidebar (with AdminMenu), Header, PageHeader, SectionHeading, ThemeToggle, WhatsNew, Popover.
- **Dashboard:** StatCard, SummaryCard, BudgetMeter, AttentionList and AttentionItem, StatusDot, LiveIndicator.
- **Data:** DataTable, Pagination, DescriptionList, EmptyState, ErrorState.
- **Charts:** BarChart, LineChart, DonutChart, ChartCard, ChartLegend. They are hand-drawn SVG and replace recharts.
- **Review:** FindingCard, CodeBlock, Disclosure.
- **Projects and settings:** AccountCard, Avatar, RepoGroup and RepoRow, ProviderKeyRow.
- **Auth:** LoginCard.

## Dashboard patterns

- **Page skeleton:** `AppShell` → `PageHeader` (h1, one-line description, right-side filters or `LiveIndicator`) → sections `space-6` apart. KPIs sit in a 4-up grid of `StatCard`. Charts go two-up in `ChartCard`, and tables are full-width in `DataTable`.
- **State mapping, used everywhere:**
  - Request status: completed → `success`, failed → `error`, queued or processing → `info` (blinks while live), cancelled, skipped or superseded → neutral.
  - Verdicts: APPROVE → `success`, REQUEST_CHANGES → `error`, COMMENT → `warning`.
  - Finding severity: critical or major → `error`, minor → `warning`, nit → neutral.
- **Charts:** use `accent` for the main series. Hatch the failure series (`hatch: true`), so it reads without color. Tint the verdict donut with the verdict tones. Axes are 3px ink, grid lines dotted `text-muted`, and ticks in `code`. Bars grow in, lines draw in, and every chart has a hover readout and an `ariaLabel`.
- **Loading, empty, error:** every data view shows a `Skeleton` shaped like the content while loading. When there is nothing to show it displays an `EmptyState` that says what will fill it, and on failure an `ErrorState` with the server's message and Retry.
- **Tables:** the header is inverted (`text` on `bg`), rows are divided by `border-thin` and tint `accent-subtle` on hover. Numbers are right-aligned in `code`, and dates stay on one line.
- **Budget:** `BudgetMeter` turns `warning` at 80% and hatched `error` when over, with the sentence underneath.

## Not synced

- **Restyled on purpose:** the repo is glassmorphism. Its token names (`bg`, `text`, `text-muted`, `accent*`, `radius-*`) are kept, but their values were re-cut for brutalism at the owner's request. `glass-bg`, `glass-border`, `glass-bg-solid`, `nav-hover`, `blob-1..3` and `shadow-glass` were retired. The scrollbar colors were skipped.
- **Fonts:** Geist and Geist Mono come from Google Fonts (`next/font/google` in the repo), so there are no font files. The bundle stylesheet loads them from Google Fonts.
- **Logos:** none in the repo. `public/` holds only the Next.js starter SVGs, which were not imported.
- **Components:** hand-written rebuilds of `components/ui/*`, `components/layout/*` and the page-local pieces (StatCard, SummaryCard, AccountCard, RepoRow, ProviderKeyRow and others) in plain React. They were not built from the repo's Radix, Tailwind and recharts sources. `RepoConfigDialog`'s form is covered by Dialog plus the form fields, not as its own component.
- **Charts:** recharts was replaced by SVG charts. They support grouped bars, a single line and a donut, not recharts' full feature set.
