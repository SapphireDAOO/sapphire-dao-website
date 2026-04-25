"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useChainId, usePublicClient } from "wagmi";
import { type Address, type Log, parseEventLogs } from "viem";
import { Multisig } from "@/abis/MultiSig";
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

  // Parse raw receipt logs and immediately apply state updates — called after
  // every on-chain action so the dashboard reflects changes without waiting
  // for any subscription or subgraph indexing.
  const applyLogs = useCallback((rawLogs: readonly Log[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any[];
    try {
      parsed = parseEventLogs({ abi: Multisig, logs: rawLogs as Log[], strict: false });
    } catch {
      return;
    }

    setData((prev) => {
      let wallet = prev.wallet;
      const txMap = new Map<string, import("@/model/multisig").MultiSigTransaction>(
        prev.transactions.map((tx) => [tx.id.toLowerCase(), tx]),
      );
      const newTxs: import("@/model/multisig").MultiSigTransaction[] = [];
      const ts = Math.floor(Date.now() / 1000).toString();

      for (const log of parsed) {
        const name = log.eventName as string;
        const args = log.args as Record<string, unknown>;

        if (name === "TransactionProposed") {
          const txHash = (args.txHash as string | undefined)?.toLowerCase();
          const target = args.target as string | undefined;
          if (!txHash || !target || txMap.has(txHash)) continue;
          const newTx: import("@/model/multisig").MultiSigTransaction = {
            id: txHash,
            target,
            value: (args.value as bigint | undefined)?.toString() ?? "0",
            data: (args.data as string | undefined) ?? "0x",
            nonce: (args.nonce as bigint | undefined)?.toString() ?? "0",
            proposer: (args.proposer as string | undefined) ?? "",
            status: "PROPOSED",
            approvalCount: "1",
            proposedAt: ts,
          };
          txMap.set(txHash, newTx);
          newTxs.push(newTx);
        } else if (name === "ApprovalAdded") {
          const txHash = (args.txHash as string | undefined)?.toLowerCase();
          const approvalCount = args.approvalCount as bigint | undefined;
          if (!txHash || approvalCount === undefined) continue;
          const tx = txMap.get(txHash);
          if (!tx) continue;
          const threshold = Number(wallet?.threshold ?? 0);
          const newCount = Number(approvalCount);
          txMap.set(txHash, {
            ...tx,
            approvalCount: newCount.toString(),
            status: threshold > 0 && newCount >= threshold ? "APPROVED" : tx.status,
          });
        } else if (name === "TransactionApproved") {
          const txHash = (args.txHash as string | undefined)?.toLowerCase();
          if (!txHash) continue;
          const tx = txMap.get(txHash);
          if (!tx) continue;
          txMap.set(txHash, { ...tx, status: "APPROVED" });
        } else if (name === "TransactionExecuted") {
          const txHash = (args.txHash as string | undefined)?.toLowerCase();
          if (!txHash) continue;
          const tx = txMap.get(txHash);
          if (!tx) continue;
          txMap.set(txHash, {
            ...tx,
            status: "EXECUTED",
            executedAt: ts,
            executor: (args.executor as string | undefined) ?? "",
          });
        } else if (name === "TransactionCanceled") {
          const txHash = (args.txHash as string | undefined)?.toLowerCase();
          if (!txHash) continue;
          const tx = txMap.get(txHash);
          if (!tx) continue;
          txMap.set(txHash, { ...tx, status: "CANCELED" });
        } else if (name === "SignerAdded") {
          const signer = args.signer as string | undefined;
          if (!signer || !wallet) continue;
          const exists = wallet.signers.some(
            (s) => s.address.toLowerCase() === signer.toLowerCase(),
          );
          const newSigners = exists
            ? wallet.signers.map((s) =>
                s.address.toLowerCase() === signer.toLowerCase()
                  ? { ...s, active: true }
                  : s,
              )
            : [
                ...wallet.signers,
                { id: `${wallet.id}-${signer.toLowerCase()}`, address: signer, active: true, addedAt: ts },
              ];
          wallet = { ...wallet, signers: newSigners, signerCount: String(newSigners.filter((s) => s.active).length) };
        } else if (name === "SignerRemoved") {
          const signer = args.signer as string | undefined;
          if (!signer || !wallet) continue;
          const newSigners = wallet.signers.map((s) =>
            s.address.toLowerCase() === signer.toLowerCase() ? { ...s, active: false } : s,
          );
          wallet = { ...wallet, signers: newSigners, signerCount: String(newSigners.filter((s) => s.active).length) };
        } else if (name === "ThresholdUpdated") {
          const newThreshold = args.newThreshold as bigint | undefined;
          if (newThreshold !== undefined && wallet) {
            wallet = { ...wallet, threshold: newThreshold.toString() };
          }
        }
      }

      const updatedExisting = prev.transactions
        .filter((tx) => !newTxs.some((n) => n.id === tx.id.toLowerCase()))
        .map((tx) => txMap.get(tx.id.toLowerCase()) ?? tx);

      return {
        ...prev,
        wallet,
        transactions: [...newTxs.reverse(), ...updatedExisting],
      };
    });
  }, []);

  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);

  return { ...data, page, nextPage, prevPage, refresh, applyLogs };
};
