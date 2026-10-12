"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sapphire:wallet-hints-dismissed";

// Safari private mode throws on localStorage access.
const readStorage = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

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
    }
  }, []);

  return { dismissed, ready, dismissForever };
};

export const resetWalletHints = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
};
