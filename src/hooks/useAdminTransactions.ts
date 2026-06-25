"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { fetchAdminTransactions } from "@/services/metrics/adminTransactions";

/** Most recent multisig transactions for the metrics page's Admin card. */
export const useAdminTransactions = (count = 5) => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-transactions", chainId, count],
    queryFn: () => fetchAdminTransactions(chainId, count),
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
