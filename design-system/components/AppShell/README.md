AppShell is the whole dashboard frame: Sidebar on the left, sticky Header on top, a scrolling content column capped at 1280px.

## When to use
Wrap every authenticated page. ⌘/Ctrl+B collapses the sidebar. Below 768px the sidebar becomes a slide-in drawer opened from the header's menu button.

## What you provide
`title` (header title), `activeHref`, `navItems` (defaults to Dashboard · Requests · AI Usage · Projects · Settings), `onNavigate(item)`, `changelog` (WhatsNew entries), `status` (healthy · degraded · down), `headerActions`, `admin` (AdminMenu props: name, email, initials, onLogout), `defaultCollapsed`, children = page content (gaps of `space-6` between sections).

## Notes
Keep one AppShell per page. Put page titles in PageHeader, not only in the header.

Hand-written brutalist rebuild of `components/layout/AppShell.tsx`.
