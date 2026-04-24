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

const multisigEvents = (Multisig as readonly { type: string }[]).filter(
  (item): item is AbiEvent => item.type === "event",
);

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

          for (const log of logs) {
            const name = log.eventName ?? "";
            const args = log.args as Record<string, unknown> | undefined;
            if (!args) continue;

            if (name === "TransactionProposed") {
              const txHash = (args.txHash as string | undefined)?.toLowerCase();
              const target = args.target as string | undefined;
              const data = args.data as string | undefined;
              const nonce = args.nonce as bigint | undefined;
              const proposer = args.proposer as string | undefined;
              const value = args.value as bigint | undefined;

              if (txHash && target && !txMap.has(txHash)) {
                const newTx: MultiSigTransaction = {
                  id: txHash,
                  target: target,
                  value: value?.toString() ?? "0",
                  data: data ?? "0x",
                  nonce: nonce?.toString() ?? "0",
                  proposer: proposer ?? "",
                  status: "PENDING",
                  approvalCount: "0",
                  proposedAt: nowSeconds(),
                };
                txMap.set(txHash, newTx);
                newTxs.push(newTx);
              }
            } else if (name === "TransactionApproved") {
              const txHash = (args.txHash as string | undefined)?.toLowerCase();
              const approvalCount = args.approvalCount as bigint | undefined;
              if (txHash && approvalCount !== undefined && txMap.has(txHash)) {
                const tx = txMap.get(txHash)!;
                const threshold = Number(wallet?.threshold ?? 0);
                const newCount = Number(approvalCount);
                txMap.set(txHash, {
                  ...tx,
                  approvalCount: newCount.toString(),
                  status:
                    threshold > 0 && newCount >= threshold
                      ? "APPROVED"
                      : tx.status,
                });
              }
            } else if (name === "TransactionExecuted") {
              const txHash = (args.txHash as string | undefined)?.toLowerCase();
              const executor = args.executor as string | undefined;
              if (txHash && txMap.has(txHash)) {
                const tx = txMap.get(txHash)!;
                txMap.set(txHash, {
                  ...tx,
                  status: "EXECUTED",
                  executedAt: nowSeconds(),
                  executor: executor ?? "",
                });
              }
            } else if (name === "TransactionCanceled") {
              const txHash = (args.txHash as string | undefined)?.toLowerCase();
              if (txHash && txMap.has(txHash)) {
                const tx = txMap.get(txHash)!;
                txMap.set(txHash, { ...tx, status: "CANCELED" });
              }
            } else if (name === "SignerAdded") {
              const signer = args.signer as string | undefined;
              if (signer && wallet) {
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
              }
            } else if (name === "SignerRemoved") {
              const signer = args.signer as string | undefined;
              if (signer && wallet) {
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
              }
            } else if (name === "ThresholdUpdated") {
              const newThreshold = args.newThreshold as bigint | undefined;
              if (newThreshold !== undefined && wallet) {
                wallet = { ...wallet, threshold: newThreshold.toString() };
              }
            }
          }

          // Prepend newly proposed txs (newest first) before existing ones
          const updatedExisting = prev.transactions
            .filter((tx) => !newTxs.some((n) => n.id === tx.id.toLowerCase()))
            .map((tx) => txMap.get(tx.id.toLowerCase()) ?? tx);

          return {
            ...prev,
            wallet,
            transactions: [...newTxs.reverse(), ...updatedExisting],
          };
        });

        onEventRef.current();
      },
      onError: (err) => console.error("multisig event watch error", err),
    });

    return () => unwatch();
  }, [active, publicClient, contractAddress, setData]);
}
