"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { fetchRecentTransactions } from "@/services/metrics/recentTransactions";
import {
  createRecentTransactionsSocket,
  type RecentTransactionsSocketHandle,
} from "@/services/metrics/recentTransactionsSocket";
import type {
  MetricsSocketStatus,
  RecentTransaction,
} from "@/services/metrics/types";

/**
 * Most recent settlement-type transactions across both processors, for the
 * metrics page's Recent Transactions card. The subgraph poll is the source of
 * truth; a live event subscription prepends rows between polls and is cleared
 * each time the poll returns (which already includes those events).
 */
export const useRecentTransactions = (count = 5) => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recent-transactions", chainId, count],
    queryFn: () => fetchRecentTransactions(chainId, count),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  // Live rows that arrived since the last poll, newest first.
  const [liveTxs, setLiveTxs] = useState<RecentTransaction[]>([]);
  const [socketStatus, setSocketStatus] =
    useState<MetricsSocketStatus>("connecting");

  // Drop optimistic rows whenever the authoritative poll result changes — the
  // fresh list already includes anything we prepended.
  useEffect(() => {
    setLiveTxs([]);
  }, [data]);

  // Keep refetch stable for the subscription effect.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let handle: RecentTransactionsSocketHandle | null = null;
    try {
      handle = createRecentTransactionsSocket(chainId, {
        onTransaction: (tx) =>
          setLiveTxs((prev) => [tx, ...prev].slice(0, count)),
        onStatus: (status) => {
          setSocketStatus(status);
          // On (re)connect, reseed from the subgraph and drop optimistic rows.
          if (status === "open") {
            setLiveTxs([]);
            refetchRef.current();
          }
        },
      });
    } catch {
      setSocketStatus("closed");
    }
    return () => handle?.close();
  }, [chainId, count]);

  // Merge live rows on top of the polled list, de-duped by tx hash + kind, capped.
  const transactions = useMemo(() => {
    const polled = data ?? [];
    const seen = new Set(polled.map((t) => `${t.txHash}-${t.kind}`));
    const live = liveTxs.filter((t) => !seen.has(`${t.txHash}-${t.kind}`));
    return [...live, ...polled].slice(0, count);
  }, [data, liveTxs, count]);

  return {
    transactions,
    isLoading,
    error: error instanceof Error ? error.message : null,
    socketStatus,
    refetch,
  };
};
