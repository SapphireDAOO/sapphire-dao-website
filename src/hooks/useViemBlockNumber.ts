"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  DEFAULT_BLOCK_POLLING_INTERVAL_MS,
  DEFAULT_QUERY_GC_TIME_MS,
} from "@/constants";
import { useIsWindowVisible } from "./useIsWindowVisible";

export const useViemBlockNumber = (
  chainId?: number,
  enabled = true,
  pollingInterval = DEFAULT_BLOCK_POLLING_INTERVAL_MS,
) => {
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const isWindowVisible = useIsWindowVisible();
  const queryKey = useMemo(
    () => ["viem-block-number", chainId] as const,
    [chainId],
  );

  const blockNumberQuery = useQuery({
    queryKey,
    enabled: Boolean(publicClient && enabled),
    queryFn: async () => {
      if (!publicClient) return undefined;
      return publicClient.getBlockNumber();
    },
    initialData: () => queryClient.getQueryData<bigint>(queryKey),
    staleTime: pollingInterval,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!publicClient || !enabled || !isWindowVisible) return;

    // A websocket subscription ignores pollingInterval and Base Sepolia makes a
    // block every 0.2s, so updates are throttled to keep RPC use in budget.
    let lastEmitAt = 0;
    const unwatch = publicClient.watchBlockNumber({
      emitMissed: true,
      emitOnBegin: true,
      pollingInterval,
      onBlockNumber: (nextBlockNumber) => {
        const now = Date.now();
        if (now - lastEmitAt < pollingInterval) return;
        lastEmitAt = now;
        queryClient.setQueryData<bigint | undefined>(queryKey, (currentBlockNumber) => {
          if (
            currentBlockNumber !== undefined &&
            nextBlockNumber <= currentBlockNumber
          ) {
            return currentBlockNumber;
          }
          return nextBlockNumber;
        });
      },
      onError: (err) => console.error("blockNumber watch error", err),
    });

    return () => {
      unwatch?.();
    };
  }, [
    publicClient,
    enabled,
    isWindowVisible,
    pollingInterval,
    queryClient,
    queryKey,
  ]);

  return blockNumberQuery;
};
