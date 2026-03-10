import { useEffect, useState } from "react";

/**
 * Returns true when the browser tab is visible (document.hidden === false).
 * Adapted from the Uniswap interface pattern — used to skip expensive queries
 * and WebSocket subscriptions when the user has backgrounded the tab.
 */
export function useIsWindowVisible(): boolean {
  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined" ? !document.hidden : true,
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
