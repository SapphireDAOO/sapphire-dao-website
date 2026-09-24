"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChainId, usePublicClient } from "wagmi";
import type { AbiEvent, Address } from "viem";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  PAYMENT_PROCESSOR_STORAGE,
} from "@/constants";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import {
  fetchPauseSnapshot,
  isEffectivelyPaused,
  type PauseActionType,
  type PauseSnapshot,
  type PauseState,
} from "@/services/pauseState";
import { useIsWindowVisible } from "./useIsWindowVisible";

const pauseEvent = (name: string) =>
  PaymentProcessorStorage.find(
    (item) => item.type === "event" && item.name === name,
  ) as AbiEvent;

// Every transition the contract announces. An emergency pause *lapsing* is
// absent on purpose: nothing is emitted for it, which is why the derived state
// below is still computed against the clock.
const PAUSE_EVENTS = [
  pauseEvent("Paused"),
  pauseEvent("Unpaused"),
  pauseEvent("EmergencyPaused"),
  pauseEvent("EmergencyPauseApproved"),
] as const;

// The pause banner, the pause card and the metrics feed all want this at once.
// Long enough that mounting them together costs one request, short enough that
// a tab left open overnight is not trusted on return.
const STALE_TIME_MS = 30_000;

const EMPTY: PauseSnapshot = { state: null, actions: [] };

const nowSeconds = () => Math.floor(Date.now() / 1000).toString();

/**
 * Pause state and history from the subgraph, kept current over the websocket.
 *
 * The chain knows whether it is paused; only the index knows who did it, when,
 * and in which transaction. That history is what the UI needs to say "paused
 * 3h ago by 0x…" and to link the transaction, and none of it is readable from
 * a view function — so the subgraph is read once, and every later change
 * arrives as a contract event rather than by asking again on a timer.
 *
 * The read is shared: several components render this at once and the endpoint
 * rate-limits, so they go through one react-query entry rather than each
 * issuing its own request.
 *
 * An event is applied to the shared cache immediately and then reconciled
 * against the index, which may not have seen the block yet. A snapshot older
 * than what this session already witnessed is discarded rather than believed.
 */
export const usePauseState = () => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const contractAddress = PAYMENT_PROCESSOR_STORAGE[chainId] as
    | Address
    | undefined;
  const isWindowVisible = useIsWindowVisible();

  const queryKey = useMemo(() => ["pause-state", chainId], [chainId]);

  // Bumped when a running emergency pause reaches its expiry, so the derived
  // value below is recomputed at that moment instead of on a poll.
  const [, setExpiryTick] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    staleTime: STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    // The endpoint answers 429 under load, and retrying immediately is how a
    // rate limit turns into a sustained one.
    retry: false,
    // The subscription is dropped while the tab is hidden, so anything that
    // happened meanwhile has to be caught on return. Unlike a manual refetch
    // this respects staleTime, so flicking between tabs costs nothing.
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const fetched = await fetchPauseSnapshot(chainId);
      const prev = queryClient.getQueryData<PauseSnapshot>(queryKey);

      const seen = Number(prev?.state?.lastActionAt ?? 0);
      const indexed = Number(fetched.state?.lastActionAt ?? 0);
      // Indexer lag: keep the event-applied state until the index catches up
      // with it, or an approval would appear to undo itself for a few blocks.
      if (prev?.state && indexed < seen) {
        return { state: prev.state, actions: fetched.actions };
      }
      return fetched;
    },
  });

  const snapshot = data ?? EMPTY;

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    if (!publicClient || !contractAddress || !isWindowVisible) return;

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: [...PAUSE_EVENTS],
      onLogs: (logs) => {
        queryClient.setQueryData<PauseSnapshot>(queryKey, (prev) => {
          let state: PauseState = prev?.state ?? { ownerPaused: false };

          for (const log of logs) {
            const name = log.eventName ?? "";
            const args = log.args as
              | { account?: string; expiry?: bigint }
              | undefined;
            const at = nowSeconds();
            const by = args?.account ?? null;
            const tx = log.transactionHash ?? null;

            const stamp = (action: PauseActionType) => ({
              lastAction: action,
              lastActionBy: by,
              lastActionAt: at,
              lastActionTx: tx,
            });

            if (name === "Paused") {
              state = { ...state, ownerPaused: true, ...stamp("PAUSED") };
            } else if (name === "Unpaused") {
              state = {
                ...state,
                ownerPaused: false,
                emergencyPauseExpiry: "0",
                ...stamp("UNPAUSED"),
              };
            } else if (name === "EmergencyPaused") {
              state = {
                ...state,
                emergencyPauseExpiry: args?.expiry?.toString() ?? "0",
                emergencyPausedBy: by,
                emergencyPausedAt: at,
                ...stamp("EMERGENCY_PAUSED"),
              };
            } else if (name === "EmergencyPauseApproved") {
              // Approval converts a timed pause into an open-ended one.
              state = {
                ...state,
                ownerPaused: true,
                emergencyPauseExpiry: "0",
                ...stamp("EMERGENCY_PAUSE_APPROVED"),
              };
            }
          }

          return { state, actions: prev?.actions ?? [] };
        });

        // The event carried the transition; this fills in the provenance the
        // index holds. Invalidating rather than refetching means the several
        // components mounting this hook still cause a single request.
        void queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => console.error("pause state watch error", err),
    });

    return () => {
      unwatch();
    };
  }, [publicClient, contractAddress, isWindowVisible, queryClient, queryKey]);

  // An emergency pause ends silently, so schedule a single re-render for the
  // moment it does rather than checking over and over.
  const expirySeconds = Number(snapshot.state?.emergencyPauseExpiry ?? 0);
  useEffect(() => {
    if (!expirySeconds) return;
    const msUntilExpiry = expirySeconds * 1000 - Date.now();
    if (msUntilExpiry <= 0) return;

    const timer = setTimeout(
      () => setExpiryTick((tick) => tick + 1),
      msUntilExpiry,
    );
    return () => clearTimeout(timer);
  }, [expirySeconds]);

  return {
    ...snapshot,
    isLoading,
    /** Derived against the clock: an emergency pause lapses without an event. */
    isPaused: isEffectivelyPaused(snapshot.state),
    refresh,
  };
};
