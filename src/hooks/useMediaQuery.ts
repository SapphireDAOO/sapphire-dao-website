import { useCallback, useSyncExternalStore } from "react";

/** Whether `query` matches; `serverValue` is used for the prerendered page. */
export const useMediaQuery = (query: string, serverValue = true) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
};
