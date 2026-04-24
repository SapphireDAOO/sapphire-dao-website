"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useChainId, usePublicClient } from "wagmi";
import { type Address } from "viem";
import { BASE_SEPOLIA, MULTISIG_CONTRACT } from "@/constants";
import { client } from "@/services/graphql/client";
import {
  MULTISIG_WALLET_QUERY,
  MULTISIG_TRANSACTIONS_QUERY,
} from "@/services/graphql/multiSigQueries";
import { MultiSigWallet, MultiSigTransaction } from "@/model/multisig";
import { useIsWindowVisible } from "./useIsWindowVisible";
import { useMultiSigEvents } from "./useMultiSigEvents";

import type { MultiSigData } from "./useMultiSigEvents";

const PAGE_SIZE = 20;
const ERROR_BACKOFF_MS = 15_000;
const EVENT_DEBOUNCE_MS = 5_000;

export const useMultiSigData = () => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const walletId = MULTISIG_CONTRACT[chainId]?.toLowerCase();
  const contractAddress = MULTISIG_CONTRACT[chainId] as Address | undefined;
  const publicClient = usePublicClient({ chainId });
  const nextAllowedRequestRef = useRef(0);
  const isWindowVisible = useIsWindowVisible();

  const [data, setData] = useState<MultiSigData>({
    wallet: null,
    transactions: [],
    hasNextPage: false,
    isLoading: true,
    error: null,
  });
  const [page, setPage] = useState(0);

  const normalizeGraphError = useCallback((message?: string) => {
    if (!message) return "Failed to load multisig data from the subgraph.";

    if (
      message.includes("Too Many Requests") ||
      message.includes("Too many requests") ||
      message.includes("429") ||
      /rate limited/i.test(message)
    ) {
      nextAllowedRequestRef.current = Date.now() + ERROR_BACKOFF_MS;
      return "Subgraph is rate limiting requests. Retry in a few seconds.";
    }

    return message;
  }, []);

  const fetchWallet = useCallback(async () => {
    if (!walletId) return null;
    const result = await client(chainId)
      .query(MULTISIG_WALLET_QUERY, { id: walletId })
      .toPromise();

    if (result.error) {
      throw new Error(result.error.message || "Failed to load multisig wallet");
    }

    return (result.data?.multiSigWallet as MultiSigWallet) ?? null;
  }, [chainId, walletId]);

  const fetchTransactions = useCallback(
    async (skip: number) => {
      if (!walletId) return [];
      const result = await client(chainId)
        .query(MULTISIG_TRANSACTIONS_QUERY, {
          walletId,
          first: PAGE_SIZE + 1,
          skip,
        })
        .toPromise();

      if (result.error) {
        throw new Error(
          result.error.message || "Failed to load multisig transactions",
        );
      }

      return (result.data?.multiSigTransactions ?? []) as MultiSigTransaction[];
    },
    [chainId, walletId],
  );

  const refresh = useCallback(async () => {
    if (!walletId) {
      setData({
        wallet: null,
        transactions: [],
        hasNextPage: false,
        isLoading: false,
        error: "Multisig contract is not configured for this network.",
      });
      return;
    }

    if (Date.now() < nextAllowedRequestRef.current) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: "Subgraph is rate limiting requests. Retry in a few seconds.",
      }));
      return;
    }

    const skip = page * PAGE_SIZE;
    try {
      const [wallet, txs] = await Promise.all([
        fetchWallet(),
        fetchTransactions(skip),
      ]);

      const hasNext = txs.length > PAGE_SIZE;

      setData({
        wallet,
        transactions: hasNext ? txs.slice(0, PAGE_SIZE) : txs,
        hasNextPage: hasNext,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = normalizeGraphError(
        error instanceof Error ? error.message : undefined,
      );

      setData({
        wallet: null,
        transactions: [],
        hasNextPage: false,
        isLoading: false,
        error: message,
      });
    }
  }, [page, walletId, fetchWallet, fetchTransactions, normalizeGraphError]);

  // Stable ref so the event watcher can call refresh without being in its deps
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  // Initial fetch and page changes
  useEffect(() => {
    setData((prev) => ({ ...prev, isLoading: true }));
    void refresh();
  }, [page, refresh]);

  // Re-fetch when the tab becomes visible after being hidden.
  const wasVisibleRef = useRef(isWindowVisible);
  useEffect(() => {
    if (isWindowVisible && !wasVisibleRef.current) {
      void refreshRef.current();
    }
    wasVisibleRef.current = isWindowVisible;
  }, [isWindowVisible]);

  // Debounced subgraph refresh triggered after events fire (gives the subgraph
  // time to index before we query it).
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(
      () => void refreshRef.current(),
      EVENT_DEBOUNCE_MS,
    );
  }, []);

  // Direct state updates from on-chain events, plus a debounced subgraph sync.
  useMultiSigEvents({
    active: isWindowVisible,
    publicClient,
    contractAddress,
    setData,
    onEvent: scheduleRefresh,
  });

  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);

  return { ...data, page, nextPage, prevPage, refresh };
};
