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

// The live socket keeps the figures moving between fetches, so a revisit
// inside this window reuses the cached snapshot instead of reseeding.
const METRICS_STALE_TIME_MS = 60_000;

/** Return a copy of `series` with `fn` applied to its last point (the current
 *  day), leaving earlier points untouched. No-op on an empty series. */
const bumpLast = <T>(series: T[], fn: (point: T) => T): T[] =>
  series.length === 0
    ? series
    : series.map((point, i) => (i === series.length - 1 ? fn(point) : point));

/** Add a live websocket delta on top of the current snapshot's values. */
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
  // Roll live deltas into the most recent day so each chart's tip tracks the
  // same optimistic totals as the cards.
  volumeSeries: bumpLast(snapshot.volumeSeries, (p) =>
    delta.volumeUsd === undefined
      ? p
      : { ...p, volumeUsd: p.volumeUsd + delta.volumeUsd },
  ),
  // The escrow chart shows the amount paid into escrow per day, so bump the
  // current day only by the payment-side (gross-in) delta.
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
  /** Latest snapshot with any optimistic websocket deltas applied; null until
   *  the first subgraph fetch resolves. */
  snapshot: MetricsSnapshot | null;
  isLoading: boolean;
  error: string | null;
  /** Live transport status, surfaced as the page's "live" indicator. */
  socketStatus: MetricsSocketStatus;
  /** Force a fresh subgraph reseed (also used on socket reconnect). */
  refetch: () => void;
}

/**
 * Hybrid metric feed: the subgraph provides the source-of-truth snapshot and
 * the websocket layers live deltas on top between fetches. On socket reconnect
 * we reseed from the subgraph, which replaces the optimistic state.
 *
 * The snapshot sits in react-query, so leaving and returning to the page
 * within METRICS_STALE_TIME_MS costs no request.
 */
export const useMetricsData = (): UseMetricsDataResult => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["metrics-snapshot", chainId], [chainId]);
  const [socketStatus, setSocketStatus] =
    useState<MetricsSocketStatus>("connecting");

  const query = useQuery({
    queryKey,
    // Subgraph call (source of truth for cumulative + windowed values).
    queryFn: () => fetchMetricsSnapshot(chainId),
    staleTime: METRICS_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    retry: false,
  });
  const { refetch: refetchQuery } = query;

  const refetch = useCallback(() => {
    void refetchQuery();
  }, [refetchQuery]);

  // Websocket: apply live deltas optimistically; reseed on reconnect.
  useEffect(() => {
    let handle: MetricsSocketHandle | null = null;
    // The socket emits "open" synchronously on creation, which always
    // coincides with the query's own load (same chain) — reseeding there would
    // just duplicate that fetch. Only reseed on a later reopen.
    let initialOpen = true;

    // Deltas go into the cached snapshot so a revisit still shows them. The
    // fetch time is kept, so the snapshot still goes stale (and is refetched)
    // on schedule however many events arrive.
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
      // On reopen, reseed from the subgraph; the result replaces the deltas.
      if (status === "open") {
        if (initialOpen) {
          initialOpen = false;
          return;
        }
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    try {
      // Websocket call (live deltas between subgraph polls).
      handle = createMetricsSocket(chainId, {
        onDelta: handleDelta,
        onStatus: handleStatus,
      });
    } catch {
      // Transport not available yet — the page still renders the subgraph
      // snapshot (or its loading/error state) without live updates.
      setSocketStatus("closed");
    }

    return () => {
      handle?.close();
    };
  }, [chainId, queryClient, queryKey]);

  return {
    snapshot: query.data ?? null,
    // Any fetch, not only the first: the refresh button spins while it runs.
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
