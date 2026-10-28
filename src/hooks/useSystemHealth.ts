"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { fetchFeeReceiverChangedAt } from "@/services/metrics/subgraphMetrics";
import { METRIC_PLACEHOLDER } from "@/components/action-components/metrics/formatMetric";

export interface SystemHealthItem {
  label: string;
  value: string;
}

const formatDaysAgo = (unixSeconds: number): string => {
  const days = Math.floor((Date.now() / 1000 - unixSeconds) / 86400);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
};

export const useSystemHealth = () => {
  const { chain } = useConnection();
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
