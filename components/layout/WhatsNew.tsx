'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Popover } from '@/components/ui/Popover';
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
  const seenVersion = React.useSyncExternalStore(subscribe, readSeenVersion, readSeenVersionOnServer);
  const hasUnseen = seenVersion !== LATEST_VERSION;

  return (
    <Popover
      align="end"
      label="What's new"
      className="prr-news"
      onOpenChange={(open) => {
        if (open) markSeen();
      }}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="prr-news-btn"
          aria-label={hasUnseen ? "What's new — unread updates" : "What's new"}
        >
          <Icon name="bell" size={18} />
          {hasUnseen && <span className="prr-news-dot" aria-hidden="true" />}
        </Button>
      }
    >
      <div className="prr-news-head">
        <p className="prr-news-title">What&apos;s new</p>
        <p className="prr-hint">Recent changes to the review pipeline</p>
      </div>
      <div className="prr-news-body">
        {CHANGELOG.map((entry, index) => (
          <section key={entry.version} className="prr-news-entry">
            <div className="prr-news-meta">
              <span className={cn('prr-news-ver', index === 0 && 'is-latest')}>v{entry.version}</span>
              <span>{entry.date}</span>
              {index === 0 && (
                <Badge variant="accent" style={{ marginLeft: 'auto' }}>
                  Latest
                </Badge>
              )}
            </div>
            <p className="prr-news-entry-title">{entry.title}</p>
            <ul className="prr-news-list">
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Popover>
  );
}

export { WhatsNew };
