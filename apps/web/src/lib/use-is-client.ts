import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false during SSR and hydration, true afterwards. For values that depend on
 * the browser (e.g. its time zone): rendering them only on the client avoids
 * a hydration mismatch, where React would keep the server's text.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
