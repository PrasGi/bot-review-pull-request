'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

const INTERVAL_MS = 5_000;
const GIVE_UP_MS = 10 * 60_000;

/** Re-renders the server page until GitHub's webhook completes the invite. */
export function AutoRefresh(): null {
  const router = useRouter();
  React.useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - startedAt > GIVE_UP_MS) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}
