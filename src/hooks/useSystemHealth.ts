"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { fetchFeeReceiverChangedAt } from "@/services/metrics/subgraphMetrics";
import { METRIC_PLACEHOLDER } from "@/components/action-components/metrics/formatMetric";

/** A single "time since X" row in the System Health card. */
export interface SystemHealthItem {
  label: string;
  /** Human "X ago" value, or the placeholder dash while loading / unavailable. */
  value: string;
}

/** Whole days between `unixSeconds` and now, as "today" / "1 day ago" / "N days ago". */
const formatDaysAgo = (unixSeconds: number): string => {
  const days = Math.floor((Date.now() / 1000 - unixSeconds) / 86400);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
};

/**
 * System Health: admin/governance activity timestamps surfaced as "X ago".
 * Currently the last fee-receiver change; will also hold the multisig's last
 * admin transaction.
 */
export const useSystemHealth = () => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  const { data: feeReceiverChangedAt, refetch } = useQuery({
    queryKey: ["fee-receiver-changed-at", chainId],
    queryFn: () => fetchFeeReceiverChangedAt(chainId),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  const items: SystemHealthItem[] = [
    {
      label: "Fee Receiver Changed",
      value:
        feeReceiverChangedAt != null
          ? formatDaysAgo(feeReceiverChangedAt)
          : METRIC_PLACEHOLDER,
    },
  ];

  return { items, refetch };
};
