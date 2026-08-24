"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sapphire:wallet-hints-dismissed";

/** Safari in private mode throws on localStorage access rather than returning null. */
const readStorage = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Whether the user has asked never to see the wallet hints again.
 *
 * Starts as `false` on the server and on first render so markup matches during
 * hydration, then settles to the stored value in an effect. Hints are gated on
 * `ready` too, so a dismissed user never sees a flash of the hint before the
 * stored preference loads.
 */
export const useHintsDismissed = () => {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDismissed(readStorage());
    setReady(true);
  }, []);

  const dismissForever = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage blocked: the hint still hides for this page view, it just
      // won't be remembered. Not worth surfacing an error over.
    }
  }, []);

  return { dismissed, ready, dismissForever };
};

/** Re-enables the hints. Wire this to a "show wallet tips again" control. */
export const resetWalletHints = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No stored preference to clear.
  }
};
