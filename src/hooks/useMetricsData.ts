"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { BASE_SEPOLIA } from "@/constants";
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
  // Roll a live volume delta into the most recent day so the chart's tip
  // tracks the same optimistic total as the Total Volume card.
  volumeSeries:
    delta.volumeUsd === undefined || snapshot.volumeSeries.length === 0
      ? snapshot.volumeSeries
      : snapshot.volumeSeries.map((point, i) =>
          i === snapshot.volumeSeries.length - 1
            ? { ...point, volumeUsd: point.volumeUsd + delta.volumeUsd! }
            : point,
        ),
  // Same treatment for escrow: nudge the latest running balance by the delta.
  escrowSeries:
    delta.escrowUsd === undefined || snapshot.escrowSeries.length === 0
      ? snapshot.escrowSeries
      : snapshot.escrowSeries.map((point, i) =>
          i === snapshot.escrowSeries.length - 1
            ? { ...point, balanceUsd: point.balanceUsd + delta.escrowUsd! }
            : point,
        ),
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
 * the websocket layers live deltas on top between polls. On socket reconnect we
 * drop optimistic state and reseed from the subgraph.
 *
 * The subgraph fetch and websocket transport are not implemented yet, so the
 * calls are wired here but currently resolve to an error / no live data.
 */
export const useMetricsData = (): UseMetricsDataResult => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] =
    useState<MetricsSocketStatus>("connecting");

  // Keep the base (subgraph) snapshot separate from the optimistic one so a
  // reconnect can cleanly drop deltas and reseed.
  const baseSnapshotRef = useRef<MetricsSnapshot | null>(null);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Subgraph call (source of truth for cumulative + windowed values).
      const next = await fetchMetricsSnapshot(chainId);
      baseSnapshotRef.current = next;
      setSnapshot(next);
    } catch (err) {
      baseSnapshotRef.current = null;
      setSnapshot(null);
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setIsLoading(false);
    }
  }, [chainId]);

  // Subgraph snapshot: initial load + reseed on chain change.
  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // Websocket: apply live deltas optimistically; reseed on reconnect.
  useEffect(() => {
    let handle: MetricsSocketHandle | null = null;

    const handleDelta = (delta: MetricsDelta) => {
      setSnapshot((prev) => (prev ? applyDelta(prev, delta) : prev));
    };

    const handleStatus = (status: MetricsSocketStatus) => {
      setSocketStatus(status);
      // On (re)open, drop optimistic state and reseed from the subgraph.
      if (status === "open") {
        if (baseSnapshotRef.current) setSnapshot(baseSnapshotRef.current);
        loadSnapshot();
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
  }, [chainId, loadSnapshot]);

  return {
    snapshot,
    isLoading,
    error,
    socketStatus,
    refetch: loadSnapshot,
  };
};
