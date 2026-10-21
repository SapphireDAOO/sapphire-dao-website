"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export const REDIRECT_SECONDS = 5;

/** Counts down once `active`, then calls `go`; returns the seconds left. */
export const useRedirectCountdown = (active: boolean, go: () => void) => {
  const [left, setLeft] = useState(REDIRECT_SECONDS);
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    if (!active) return;
    if (left <= 0) {
      goRef.current();
      return;
    }
    const timer = setTimeout(() => setLeft((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [active, left]);

  return left;
};

export const RedirectNotice = ({
  destination,
  seconds,
}: {
  destination: string;
  seconds?: number;
}) => (
  <p
    role="status"
    className="flex items-center gap-2 rounded-xl bg-white/70 p-3 font-medium text-stone-900"
  >
    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-900" />
    Redirecting to {destination}
    {seconds !== undefined ? ` in ${seconds}s` : ""}…
  </p>
);
