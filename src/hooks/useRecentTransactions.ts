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

export const useRecentTransactions = (count = 5) => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recent-transactions", chainId, count],
    queryFn: () => fetchRecentTransactions(chainId, count),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  const [liveTxs, setLiveTxs] = useState<RecentTransaction[]>([]);
  const [socketStatus, setSocketStatus] =
    useState<MetricsSocketStatus>("connecting");

  useEffect(() => {
    setLiveTxs([]);
  }, [data]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let handle: RecentTransactionsSocketHandle | null = null;
    // The socket opens synchronously alongside the
    // query's own load, so only a later reopen reseeds.
    let initialOpen = true;
    try {
      handle = createRecentTransactionsSocket(chainId, {
        onTransaction: (tx) =>
          setLiveTxs((prev) => [tx, ...prev].slice(0, count)),
        onStatus: (status) => {
          setSocketStatus(status);
          if (status === "open") {
            if (initialOpen) {
              initialOpen = false;
              return;
            }
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
