"use client";

import { useEffect, useState } from "react";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

const start = () => {
  if (timer) return;
  timer = setInterval(() => {
    listeners.forEach((listener) => listener());
  }, 1000);
};

const stop = () => {
  if (!timer || listeners.size > 0) return;
  clearInterval(timer);
  timer = null;
};

export const useSharedSecondTicker = (enabled: boolean) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const listener = () => {
      setTick((value) => value + 1);
    };

    listeners.add(listener);
    start();

    return () => {
      listeners.delete(listener);
      stop();
    };
  }, [enabled]);

  return tick;
};
