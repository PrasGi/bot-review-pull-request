'use client';

import * as React from 'react';

/** Current time, re-rendered every `intervalMs`, so elapsed times move between polls. */
export function useNow(intervalMs = 1_000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
