"use client";

import { useEffect, useRef } from "react";
import { type AbiEvent, type Address } from "viem";
import type { PublicClient } from "viem";
import { Multisig } from "@/abis/MultiSig";
import { MultiSigWallet, MultiSigTransaction } from "@/model/multisig";

export interface MultiSigData {
  wallet: MultiSigWallet | null;
  transactions: MultiSigTransaction[];
  hasNextPage: boolean;
  isLoading: boolean;
  error: string | null;
}

interface Params {
  active: boolean;
  publicClient: PublicClient | undefined;
  contractAddress: Address | undefined;
  setData: React.Dispatch<React.SetStateAction<MultiSigData>>;
  onEvent: () => void;
}

// Pre-define each ABI event once (same pattern as TransactionDetail)
const proposedEvent = Multisig.find(
  (e) => e.type === "event" && e.name === "TransactionProposed",
) as AbiEvent;
const approvalAddedEvent = Multisig.find(
  (e) => e.type === "event" && e.name === "ApprovalAdded",
) as AbiEvent;
const txApprovedEvent = Multisig.find(
  (e) => e.type === "event" && e.name === "TransactionApproved",
) as AbiEvent;
const executedEvent = Multisig.find(
  (e) => e.type === "event" && e.name === "TransactionExecuted",
) as AbiEvent;
const canceledEvent = Multisig.find(
  (e) => e.type === "event" && e.name === "TransactionCanceled",
) as AbiEvent;
const signerAddedEvent = Multisig.find(
  (e) => e.type === "event" && e.name === "SignerAdded",
) as AbiEvent;
const signerRemovedEvent = Multisig.find(
  (e) => e.type === "event" && e.name === "SignerRemoved",
) as AbiEvent;
const thresholdUpdatedEvent = Multisig.find(
  (e) => e.type === "event" && e.name === "ThresholdUpdated",
) as AbiEvent;
const multisigEvents = [
  proposedEvent,
  approvalAddedEvent,
  txApprovedEvent,
  executedEvent,
  canceledEvent,
  signerAddedEvent,
  signerRemovedEvent,
  thresholdUpdatedEvent,
] as const;

function nowSeconds(): string {
  return Math.floor(Date.now() / 1000).toString();
}

export function useMultiSigEvents({
  active,
  publicClient,
  contractAddress,
  setData,
  onEvent,
}: Params) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!active || !publicClient || !contractAddress) return;

    const fire = () => onEventRef.current();

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: multisigEvents,
      onLogs: (logs) => {
        setData((prev) => {
          let wallet = prev.wallet;
          const txMap = new Map<string, MultiSigTransaction>(
            prev.transactions.map((tx) => [tx.id.toLowerCase(), tx]),
          );
          const newTxs: MultiSigTransaction[] = [];
          const newTxIds = new Set<string>();
          let changedTransactions = false;
          let changedWallet = false;

          for (const log of logs) {
            const name = log.eventName ?? "";
            const args = log.args as
              | {
                  txHash?: string;
                  target?: string;
                  value?: bigint;
                  data?: string;
                  nonce?: bigint;
                  proposer?: string;
                  approvalCount?: bigint;
                  executor?: string;
                  signer?: string;
                  newThreshold?: bigint;
                }
              | undefined;

            if (!args) continue;

            if (name === "TransactionProposed") {
              const txHash = args.txHash?.toLowerCase();
              if (!txHash || !args.target || txMap.has(txHash)) continue;
              const newTx: MultiSigTransaction = {
                id: txHash,
                target: args.target,
                value: args.value?.toString() ?? "0",
                data: args.data ?? "0x",
                nonce: args.nonce?.toString() ?? "0",
                proposer: args.proposer ?? "",
                status: "PROPOSED",
                approvalCount: "1",
                proposedAt: nowSeconds(),
              };
              txMap.set(txHash, newTx);
              newTxs.push(newTx);
              newTxIds.add(txHash);
              changedTransactions = true;
              continue;
            }

            if (name === "ApprovalAdded") {
              const txHash = args.txHash?.toLowerCase();
              if (!txHash || args.approvalCount === undefined) continue;
              const tx = txMap.get(txHash);
              if (!tx) continue;
              const threshold = Number(wallet?.threshold ?? 0);
              const newCount = Number(args.approvalCount);
              txMap.set(txHash, {
                ...tx,
                approvalCount: newCount.toString(),
                status:
                  threshold > 0 && newCount >= threshold
                    ? "APPROVED"
                    : tx.status,
              });
              changedTransactions = true;
              continue;
            }

            if (name === "TransactionApproved") {
              const txHash = args.txHash?.toLowerCase();
              if (!txHash) continue;
              const tx = txMap.get(txHash);
              if (!tx) continue;
              txMap.set(txHash, { ...tx, status: "APPROVED" });
              changedTransactions = true;
              continue;
            }

            if (name === "TransactionExecuted") {
              const txHash = args.txHash?.toLowerCase();
              if (!txHash) continue;
              const tx = txMap.get(txHash);
              if (!tx) continue;
              txMap.set(txHash, {
                ...tx,
                status: "EXECUTED",
                executedAt: nowSeconds(),
                executor: args.executor ?? "",
              });
              changedTransactions = true;
              continue;
            }

            if (name === "TransactionCanceled") {
              const txHash = args.txHash?.toLowerCase();
              if (!txHash) continue;
              const tx = txMap.get(txHash);
              if (!tx) continue;
              txMap.set(txHash, { ...tx, status: "CANCELED" });
              changedTransactions = true;
              continue;
            }

            if (name === "SignerAdded") {
              if (!wallet || !args.signer) continue;
              const signer = args.signer;
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
                    {
                      id: `${wallet.id}-${signer.toLowerCase()}`,
                      address: signer,
                      active: true,
                      addedAt: nowSeconds(),
                    },
                  ];
              wallet = {
                ...wallet,
                signers: newSigners,
                signerCount: String(newSigners.filter((s) => s.active).length),
              };
              changedWallet = true;
              continue;
            }

            if (name === "SignerRemoved") {
              if (!wallet || !args.signer) continue;
              const signer = args.signer;
              const newSigners = wallet.signers.map((s) =>
                s.address.toLowerCase() === signer.toLowerCase()
                  ? { ...s, active: false }
                  : s,
              );
              wallet = {
                ...wallet,
                signers: newSigners,
                signerCount: String(newSigners.filter((s) => s.active).length),
              };
              changedWallet = true;
              continue;
            }

            if (name === "ThresholdUpdated") {
              if (!wallet || args.newThreshold === undefined) continue;
              wallet = { ...wallet, threshold: args.newThreshold.toString() };
              changedWallet = true;
            }
          }

          if (!changedTransactions && !changedWallet) return prev;

          const updatedTransactions = changedTransactions
            ? newTxIds.size > 0
              ? [
                  ...newTxs.reverse(),
                  ...Array.from(txMap.values()).filter(
                    (tx) => !newTxIds.has(tx.id.toLowerCase()),
                  ),
                ]
              : Array.from(txMap.values())
            : prev.transactions;

          queueMicrotask(fire);

          return {
            ...prev,
            wallet: changedWallet ? wallet : prev.wallet,
            transactions: updatedTransactions,
          };
        });
      },
      onError: (err) => console.error("multisig event watch error", err),
    });

    return () => {
      unwatch();
    };
  }, [active, publicClient, contractAddress, setData]);
}
