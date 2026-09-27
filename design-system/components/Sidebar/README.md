Sidebar is the ink-edged navigation column with brand, nav links, collapse control and the admin menu at the foot.

## When to use
Used by AppShell. Use it directly only for custom shells. Active link = solid `accent` slab; hover = `highlight` with a 3px nudge; collapsed (72px) links show tooltips on the right.

## What you provide
`items: {label, href, icon, badge?, active?}[]` (icon = an Icon name or element), `activeHref`, `collapsed` / `defaultCollapsed`, `onCollapsedChange`, `onNavigate(item)` (prevents default link nav), `admin` props, `footer` (replace the admin menu), `mobile` + `onClose` for drawer mode, `brandName`.

## Notes
Five to seven items max; counts go in `badge`, not in the label.

Hand-written brutalist rebuild of `components/layout/Sidebar.tsx`.
