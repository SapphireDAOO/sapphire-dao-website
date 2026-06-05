"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { fetchRecentTransactions } from "@/services/metrics/recentTransactions";

/**
 * Most recent settlement-type transactions across both processors, for the
 * metrics page's Recent Transactions card. Poll-based off the subgraph.
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

  return {
    transactions: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
};
