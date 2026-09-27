AttentionList stacks AttentionItem callouts — things the admin must act on — and shows 'All clear' when empty.

## When to use
Dashboard 'Needs attention': accounts to reconnect, expiring connections, stale repos, failed reviews.

## What you provide
AttentionList: children (AttentionItem), `emptyText`. AttentionItem: `tone` (warning · error · neutral · success), `icon`, `title`, `tags[]` (badges), `action: {label, href | onClick}`.

## Notes
Title states count + problem; the action says where to fix it.

Hand-written brutalist rebuild of `app/(dashboard)/page.tsx`.
