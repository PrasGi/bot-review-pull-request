'use client';

import * as React from 'react';
import { reconcileSearch, type SearchSyncState } from '@/lib/ui/search-sync';

/**
 * A controlled search input synced to a URL param. The input is never
 * remounted, so typing or deleting during the debounce keeps its text,
 * focus and caret.
 */
export function useDebouncedSearch(
  urlValue: string,
  commit: (value: string) => void,
  delayMs = 300
): { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void } {
  const [state, setState] = React.useState<SearchSyncState>({ text: urlValue, pending: [] });
  const [seenUrl, setSeenUrl] = React.useState(urlValue);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = React.useRef(commit);

  React.useEffect(() => {
    commitRef.current = commit;
  });
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  // Adjusting state while rendering (not in an effect) avoids a flash of stale text.
  if (urlValue !== seenUrl) {
    setSeenUrl(urlValue);
    setState((prev) => reconcileSearch(prev, urlValue));
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value;
    setState((prev) => ({ ...prev, text: next }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState((prev) => ({ ...prev, pending: [...prev.pending, next] }));
      commitRef.current(next);
    }, delayMs);
  };

  return { value: state.text, onChange };
}
