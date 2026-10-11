"use client";

import { useEffect, useState } from "react";

// setTimeout fires immediately for anything longer than this (~24.8 days).
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Whether the clock has passed `atMs`. Re-renders once, at that moment,
 * rather than on a per-second ticker.
 */
export const useHasPassed = (atMs?: number) => {
  // Bumped by the timer; a deadline further out than one timeout can reach
  // re-arms from here.
  const [wakeups, setWakeups] = useState(0);
  const passed =
    atMs !== undefined && Number.isFinite(atMs) && Date.now() > atMs;

  useEffect(() => {
    if (atMs === undefined || !Number.isFinite(atMs) || passed) return;
    const delay = Math.min(atMs - Date.now() + 1, MAX_TIMEOUT_MS);
    const timer = setTimeout(() => setWakeups((count) => count + 1), delay);
    return () => clearTimeout(timer);
  }, [atMs, passed, wakeups]);

  return passed;
};
