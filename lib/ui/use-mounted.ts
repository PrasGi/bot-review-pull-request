import { useSyncExternalStore } from "react";

const noopSubscribe = (): (() => void) => () => {};

/** False during SSR and hydration, true afterwards. Use it to defer browser-only UI without a hydration mismatch. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
