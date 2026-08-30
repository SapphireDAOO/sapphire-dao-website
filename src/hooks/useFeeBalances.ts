"use client";

import { useCallback, useEffect, useState } from "react";
import { useChainId } from "wagmi";
import { BASE_SEPOLIA } from "@/constants";
import type { SweepTransaction, TokenFeeSummary } from "@/model/fees";
import {
  FEES_NOT_INDEXED_MESSAGE,
  fetchFeeReceiverBalances,
  fetchRecentSweeps,
  isFeesNotIndexedError,
  summarizeFeesByToken,
} from "@/services/fees/feeBalances";

interface FeeBalancesState {
  tokens: TokenFeeSummary[];
  sweeps: SweepTransaction[];
  /** True when the receiver set was larger than the page cap, so totals are a lower bound. */
  truncated: boolean;
  isLoading: boolean;
  error: string | null;
  /** True when this subgraph deployment predates the fee-receiver entities. */
  notIndexed: boolean;
}

const INITIAL: FeeBalancesState = {
  tokens: [],
  sweeps: [],
  truncated: false,
  isLoading: true,
  error: null,
  notIndexed: false,
};

/**
 * Unswept platform fees grouped by token, plus recent sweeps. Fee receivers are
 * one-time addresses, so this reads the whole non-zero balance set and adds it
 * up rather than tracking a single treasury address.
 */
export const useFeeBalances = () => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const [state, setState] = useState<FeeBalancesState>(INITIAL);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const [{ rows, truncated }, sweeps] = await Promise.all([
        fetchFeeReceiverBalances(chainId),
        fetchRecentSweeps(chainId).catch(() => []),
      ]);

      setState({
        tokens: summarizeFeesByToken(chainId, rows),
        sweeps,
        truncated,
        isLoading: false,
        error: null,
        notIndexed: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load fee balances.";
      const notIndexed = isFeesNotIndexedError(message);

      setState({
        ...INITIAL,
        isLoading: false,
        notIndexed,
        error: notIndexed ? FEES_NOT_INDEXED_MESSAGE : message,
      });
    }
  }, [chainId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
};
