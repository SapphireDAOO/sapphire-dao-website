"use client";

import { useCallback, useEffect, useState } from "react";
import { useChainId } from "wagmi";
import { BASE_SEPOLIA } from "@/constants";
import {
  fetchPauseSnapshot,
  isEffectivelyPaused,
  type PauseSnapshot,
} from "@/services/pauseState";

const POLL_MS = 15_000;

/**
 * Pause state and history from the subgraph.
 *
 * The chain knows whether it is paused; only the index knows who did it, when,
 * and in which transaction. That history is what the UI needs to say "paused
 * 3h ago by 0x…" and to link the transaction, and none of it is readable from
 * a view function.
 */
export const usePauseState = () => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const [snapshot, setSnapshot] = useState<PauseSnapshot>({
    state: null,
    actions: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await fetchPauseSnapshot(chainId));
    } catch (error) {
      // A subgraph that has not indexed these entities yet must not take the
      // page down; callers fall back to the contract read.
      console.error("Failed to load pause state", error);
    } finally {
      setIsLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return {
    ...snapshot,
    isLoading,
    /** Derived against the clock: an emergency pause lapses without an event. */
    isPaused: isEffectivelyPaused(snapshot.state),
    refresh,
  };
};
