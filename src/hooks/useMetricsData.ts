"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { BASE_SEPOLIA, DEFAULT_QUERY_GC_TIME_MS } from "@/constants";
import { fetchMetricsSnapshot } from "@/services/metrics/subgraphMetrics";
import {
  createMetricsSocket,
  type MetricsSocketHandle,
} from "@/services/metrics/metricsSocket";
import type {
  MetricsDelta,
  MetricsSnapshot,
  MetricsSocketStatus,
} from "@/services/metrics/types";

const METRICS_STALE_TIME_MS = 60_000;

const bumpLast = <T>(series: T[], fn: (point: T) => T): T[] =>
  series.length === 0
    ? series
    : series.map((point, i) => (i === series.length - 1 ? fn(point) : point));

const applyDelta = (
  snapshot: MetricsSnapshot,
  delta: MetricsDelta,
): MetricsSnapshot => ({
  ...snapshot,
  totalVolume:
    delta.volumeUsd === undefined
      ? snapshot.totalVolume
      : {
          ...snapshot.totalVolume,
          value: snapshot.totalVolume.value + delta.volumeUsd,
        },
  escrowBalance:
    delta.escrowUsd === undefined
      ? snapshot.escrowBalance
      : {
          ...snapshot.escrowBalance,
          value: snapshot.escrowBalance.value + delta.escrowUsd,
        },
  feesPaid:
    delta.feesUsd === undefined
      ? snapshot.feesPaid
      : {
          ...snapshot.feesPaid,
          value: snapshot.feesPaid.value + delta.feesUsd,
        },
  invoicesPaid:
    delta.invoicesPaid === undefined
      ? snapshot.invoicesPaid
      : {
          ...snapshot.invoicesPaid,
          value: snapshot.invoicesPaid.value + delta.invoicesPaid,
        },
  volumeSeries: bumpLast(snapshot.volumeSeries, (p) =>
    delta.volumeUsd === undefined
      ? p
      : { ...p, volumeUsd: p.volumeUsd + delta.volumeUsd },
  ),
  escrowSeries: bumpLast(snapshot.escrowSeries, (p) =>
    delta.escrowPaidUsd === undefined
      ? p
      : { ...p, balanceUsd: p.balanceUsd + delta.escrowPaidUsd },
  ),
  invoiceActivitySeries: bumpLast(snapshot.invoiceActivitySeries, (p) => ({
    ...p,
    website: p.website + (delta.activityWebsite ?? 0),
    intermediated: p.intermediated + (delta.activityIntermediated ?? 0),
  })),
});

export interface UseMetricsDataResult {
  snapshot: MetricsSnapshot | null;
  isLoading: boolean;
  error: string | null;
  socketStatus: MetricsSocketStatus;
  refetch: () => void;
}

export const useMetricsData = (): UseMetricsDataResult => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["metrics-snapshot", chainId], [chainId]);
  const [socketStatus, setSocketStatus] =
    useState<MetricsSocketStatus>("connecting");

  const query = useQuery({
    queryKey,
    queryFn: () => fetchMetricsSnapshot(chainId),
    staleTime: METRICS_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    retry: false,
  });
  const { refetch: refetchQuery } = query;

  const refetch = useCallback(() => {
    void refetchQuery();
  }, [refetchQuery]);

  useEffect(() => {
    let handle: MetricsSocketHandle | null = null;
    // The socket opens synchronously alongside the
    // query's own load, so only a later reopen reseeds.
    let initialOpen = true;

    const handleDelta = (delta: MetricsDelta) => {
      const updatedAt = queryClient.getQueryState(queryKey)?.dataUpdatedAt;
      queryClient.setQueryData<MetricsSnapshot>(
        queryKey,
        (prev) => (prev ? applyDelta(prev, delta) : prev),
        { updatedAt },
      );
    };

    const handleStatus = (status: MetricsSocketStatus) => {
      setSocketStatus(status);
      if (status === "open") {
        if (initialOpen) {
          initialOpen = false;
          return;
        }
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    try {
      handle = createMetricsSocket(chainId, {
        onDelta: handleDelta,
        onStatus: handleStatus,
      });
    } catch {
      setSocketStatus("closed");
    }

    return () => {
      handle?.close();
    };
  }, [chainId, queryClient, queryKey]);

  return {
    snapshot: query.data ?? null,
    isLoading: query.isFetching,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load metrics"
      : null,
    socketStatus,
    refetch,
  };
};
