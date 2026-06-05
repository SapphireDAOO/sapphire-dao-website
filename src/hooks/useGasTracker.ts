"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther, formatGwei } from "viem";
import {
  BASE_SEPOLIA,
  DEFAULT_BLOCK_POLLING_INTERVAL_MS,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { fetchGasStats } from "@/services/metrics/gasTracker";
import { fetchNativePriceUsd } from "@/services/metrics/subgraphMetrics";
import {
  formatUsd,
  formatCount,
  METRIC_PLACEHOLDER,
} from "@/components/action-components/metrics/formatMetric";

/** A single tile in the Gas Tracker card. */
export interface GasTile {
  label: string;
  value: string;
  /** Secondary USD line; omitted for non-monetary tiles (gas price, count). */
  usd?: string;
}

const formatEth = (wei: bigint): string =>
  `${Number(formatEther(wei)).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} ETH`;

const formatGweiLabel = (wei: bigint): string =>
  `${Number(formatGwei(wei)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} gwei`;

/**
 * Backs the metrics page's Gas Tracker card: cumulative gas spend + transaction
 * count from the subgraph, average derived on the client, and the live gas price
 * from the connected RPC.
 */
export const useGasTracker = () => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["gas-stats", chainId],
    queryFn: () => fetchGasStats(chainId),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  const { data: nativePrice } = useQuery({
    queryKey: ["native-price-usd", chainId],
    queryFn: () => fetchNativePriceUsd(chainId),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  const { data: gasPriceWei } = useQuery({
    queryKey: ["gas-price", chainId],
    enabled: Boolean(publicClient),
    queryFn: () => publicClient!.getGasPrice(),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    refetchInterval: DEFAULT_BLOCK_POLLING_INTERVAL_MS,
  });

  const toUsd = (ethValue: number): string | undefined =>
    nativePrice !== undefined ? formatUsd(ethValue * nativePrice) : undefined;

  const totalEth = stats ? Number(formatEther(stats.totalGasWei)) : undefined;
  const avgEth =
    stats && stats.transactionCount > 0
      ? Number(formatEther(stats.totalGasWei)) / stats.transactionCount
      : undefined;

  const tiles: GasTile[] = [
    {
      label: "Total Gas Paid",
      value: stats ? formatEth(stats.totalGasWei) : METRIC_PLACEHOLDER,
      usd: totalEth !== undefined ? toUsd(totalEth) : undefined,
    },
    {
      label: "Avg Gas / Transaction",
      value:
        avgEth !== undefined
          ? `${avgEth.toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`
          : METRIC_PLACEHOLDER,
      usd: avgEth !== undefined ? toUsd(avgEth) : undefined,
    },
    {
      label: "Current Gas Price",
      value:
        gasPriceWei !== undefined
          ? formatGweiLabel(gasPriceWei)
          : METRIC_PLACEHOLDER,
    },
    {
      label: "Transactions",
      value: stats ? formatCount(stats.transactionCount) : METRIC_PLACEHOLDER,
    },
  ];

  return {
    tiles,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
};
