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
import {
  readPendingTransactions,
  savePendingTransactions,
} from "@/lib/multisigPendingStore";
import { useIsWindowVisible } from "./useIsWindowVisible";
import { useMultiSigEvents } from "./useMultiSigEvents";

import type { MultiSigData } from "./useMultiSigEvents";

const PAGE_SIZE = 20;

const STATUS_RANK: Record<MultiSigTransaction["status"], number> = {
  PROPOSED: 0,
  APPROVED: 1,
  EXECUTED: 2,
  CANCELED: 2,
};

// Whichever of the local and indexed copies is further along
// wins, field by field; the subgraph can trail a receipt.
const mergeIndexedTransaction = (
  local: MultiSigTransaction,
  indexed: MultiSigTransaction,
): MultiSigTransaction => {
  const localCount = Number(local.approvalCount ?? 0);
  const indexedCount = Number(indexed.approvalCount ?? 0);
  const localIsFurther = STATUS_RANK[local.status] > STATUS_RANK[indexed.status];

  if (!localIsFurther && indexedCount >= localCount) return indexed;

  return {
    ...indexed,
    status: localIsFurther ? local.status : indexed.status,
    approvalCount: String(Math.max(localCount, indexedCount)),
    executedAt: indexed.executedAt ?? local.executedAt,
    executor: indexed.executor ?? local.executor,
    unindexed: true,
  };
};
const ERROR_BACKOFF_MS = 15_000;

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
      .query(
        MULTISIG_WALLET_QUERY,
        { id: walletId },
      )
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
        .query(
          MULTISIG_TRANSACTIONS_QUERY,
          {
            walletId,
            first: PAGE_SIZE + 1,
            skip,
          },
        )
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
      const fetched = hasNext ? txs.slice(0, PAGE_SIZE) : txs;

      setData((prev) => {
        // Keep receipt-applied transactions the index hasn't caught
        // up to; they sort newest-first, so only on page one.
        const stillUnindexed =
          skip > 0
            ? []
            : prev.transactions.filter(
                (tx) =>
                  tx.unindexed &&
                  !fetched.some(
                    (indexed) => indexed.id.toLowerCase() === tx.id.toLowerCase(),
                  ),
              );

        const localById = new Map(
          prev.transactions.map((tx) => [tx.id.toLowerCase(), tx]),
        );
        const reconciled = fetched.map((indexed) => {
          const local = localById.get(indexed.id.toLowerCase());
          return local ? mergeIndexedTransaction(local, indexed) : indexed;
        });

        return {
          wallet,
          transactions: [...stillUnindexed, ...reconciled],
          hasNextPage: hasNext,
          isLoading: false,
          error: null,
        };
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

  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    setData((prev) => ({ ...prev, isLoading: true }));
    void refresh();
  }, [page, refresh]);

  // Seeded on mount: the static export prerenders without storage.
  useEffect(() => {
    const pending = readPendingTransactions(chainId);
    if (pending.length === 0) return;

    setData((prev) => ({
      ...prev,
      transactions: [
        ...pending.filter(
          (tx) =>
            !prev.transactions.some(
              (known) => known.id.toLowerCase() === tx.id.toLowerCase(),
            ),
        ),
        ...prev.transactions,
      ],
    }));
  }, [chainId]);

  const wasVisibleRef = useRef(isWindowVisible);
  useEffect(() => {
    if (isWindowVisible && !wasVisibleRef.current) {
      void refreshRef.current();
    }
    wasVisibleRef.current = isWindowVisible;
  }, [isWindowVisible]);

  useMultiSigEvents({
    active: isWindowVisible,
    publicClient,
    contractAddress,
    setData,
  });

  useEffect(() => {
    if (!walletId) return;
    savePendingTransactions(
      chainId,
      data.transactions.filter((tx) => tx.unindexed),
    );
  }, [chainId, walletId, data.transactions]);

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
            unindexed: true,
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
            unindexed: true,
          });
        } else if (name === "TransactionApproved") {
          const txHash = (args.txHash as string | undefined)?.toLowerCase();
          if (!txHash) continue;
          const tx = txMap.get(txHash);
          if (!tx) continue;
          txMap.set(txHash, { ...tx, status: "APPROVED", unindexed: true });
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
            unindexed: true,
          });
        } else if (name === "TransactionCanceled") {
          const txHash = (args.txHash as string | undefined)?.toLowerCase();
          if (!txHash) continue;
          const tx = txMap.get(txHash);
          if (!tx) continue;
          txMap.set(txHash, { ...tx, status: "CANCELED", unindexed: true });
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
