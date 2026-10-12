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

// A lapsing emergency pause emits nothing,
// hence the clock-based derivation below.
const PAUSE_EVENTS = [
  pauseEvent("Paused"),
  pauseEvent("Unpaused"),
  pauseEvent("EmergencyPaused"),
  pauseEvent("EmergencyPauseApproved"),
] as const;

const STALE_TIME_MS = 30_000;

const EMPTY: PauseSnapshot = { state: null, actions: [] };

const nowSeconds = () => Math.floor(Date.now() / 1000).toString();

export const usePauseState = () => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const contractAddress = PAYMENT_PROCESSOR_STORAGE[chainId] as
    | Address
    | undefined;
  const isWindowVisible = useIsWindowVisible();

  const queryKey = useMemo(() => ["pause-state", chainId], [chainId]);

  const [, setExpiryTick] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    staleTime: STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    // The endpoint answers 429 under load; immediate retries prolong it.
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const fetched = await fetchPauseSnapshot(chainId);
      const prev = queryClient.getQueryData<PauseSnapshot>(queryKey);

      const seen = Number(prev?.state?.lastActionAt ?? 0);
      const indexed = Number(fetched.state?.lastActionAt ?? 0);
      // Indexer lag: keep the event-applied state until the index catches up.
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

        void queryClient.invalidateQueries({ queryKey });

        // useEmergencyPause's reads aren't polled, so this is
        // their refresh. Prefix of useViemReadContract's key.
        for (const functionName of ["isPaused", "getEmergencyPauseExpiry"]) {
          void queryClient.invalidateQueries({
            queryKey: ["viem-read", chainId, contractAddress, functionName],
          });
        }
      },
      onError: (err) => console.error("pause state watch error", err),
    });

    return () => {
      unwatch();
    };
  }, [
    publicClient,
    contractAddress,
    isWindowVisible,
    queryClient,
    queryKey,
    chainId,
  ]);

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
    isPaused: isEffectivelyPaused(snapshot.state),
    refresh,
  };
};
