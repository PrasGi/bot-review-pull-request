'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/DropdownMenu';
import { CHANGELOG, LATEST_VERSION } from '@/lib/changelog';

const SEEN_KEY = 'pr-reviewer:changelog-seen';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readSeenVersion(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

// The server cannot know what this browser has seen; claiming "already seen"
// keeps the dot from flashing on every load before hydration corrects it.
function readSeenVersionOnServer(): string {
  return LATEST_VERSION;
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, LATEST_VERSION);
  } catch {
    // Private-mode browsers reject writes; the dot simply returns next visit.
  }
  for (const listener of listeners) listener();
}

function WhatsNew(): React.ReactElement {
  const seenVersion = React.useSyncExternalStore(
    subscribe,
    readSeenVersion,
    readSeenVersionOnServer,
  );
  const hasUnseen = seenVersion !== LATEST_VERSION;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) markSeen();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={hasUnseen ? "What's new — unread updates" : "What's new"}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {hasUnseen && (
            <span
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[oklch(0.70_0.18_45)] shadow-[0_0_0_2px_var(--surface)]"
              aria-hidden="true"
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto p-0"
      >
        <div className="sticky top-0 z-10 glass-panel rounded-none border-x-0 border-t-0 px-4 py-3">
          <p className="text-sm font-semibold text-[var(--text)]">What&apos;s new</p>
          <p className="text-xs text-[var(--text-muted)]">
            Recent changes to the review pipeline
          </p>
        </div>

        <div className="flex flex-col gap-4 px-4 py-3">
          {CHANGELOG.map((entry, index) => (
            <section key={entry.version} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    index === 0 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
                  )}
                >
                  v{entry.version}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{entry.date}</span>
                {index === 0 && (
                  <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--accent)] bg-[var(--nav-hover)]">
                    Latest
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-[var(--text)]">{entry.title}</p>
              <ul className="flex flex-col gap-1">
                {entry.changes.map((change) => (
                  <li
                    key={change}
                    className="flex gap-2 text-xs leading-relaxed text-[var(--text-muted)]"
                  >
                    <span aria-hidden="true">·</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { WhatsNew };
