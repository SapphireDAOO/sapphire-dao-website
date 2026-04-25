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

    const unwatchProposed = publicClient.watchEvent({
      address: contractAddress,
      event: proposedEvent,
      onLogs: (logs) => {
        setData((prev) => {
          const txMap = new Map<string, MultiSigTransaction>(
            prev.transactions.map((tx) => [tx.id.toLowerCase(), tx]),
          );
          const newTxs: MultiSigTransaction[] = [];

          for (const log of logs) {
            const args = log.args as {
              txHash?: string;
              target?: string;
              value?: bigint;
              data?: string;
              nonce?: bigint;
              proposer?: string;
            };
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
          }

          if (newTxs.length === 0) return prev;

          const updatedExisting = prev.transactions.map(
            (tx) => txMap.get(tx.id.toLowerCase()) ?? tx,
          );
          return {
            ...prev,
            transactions: [...newTxs.reverse(), ...updatedExisting],
          };
        });
        fire();
      },
      onError: (err) => console.error("multisig proposed watch error", err),
    });

    const unwatchApprovalAdded = publicClient.watchEvent({
      address: contractAddress,
      event: approvalAddedEvent,
      onLogs: (logs) => {
        setData((prev) => {
          const txMap = new Map<string, MultiSigTransaction>(
            prev.transactions.map((tx) => [tx.id.toLowerCase(), tx]),
          );
          let changed = false;

          for (const log of logs) {
            const args = log.args as {
              txHash?: string;
              approvalCount?: bigint;
            };
            const txHash = args.txHash?.toLowerCase();
            if (!txHash || args.approvalCount === undefined) continue;
            const tx = txMap.get(txHash);
            if (!tx) continue;
            const threshold = Number(prev.wallet?.threshold ?? 0);
            const newCount = Number(args.approvalCount);
            txMap.set(txHash, {
              ...tx,
              approvalCount: newCount.toString(),
              status:
                threshold > 0 && newCount >= threshold ? "APPROVED" : tx.status,
            });
            changed = true;
          }

          if (!changed) return prev;
          return {
            ...prev,
            transactions: prev.transactions.map(
              (tx) => txMap.get(tx.id.toLowerCase()) ?? tx,
            ),
          };
        });
        fire();
      },
      onError: (err) => console.error("multisig approvalAdded watch error", err),
    });

    const unwatchTxApproved = publicClient.watchEvent({
      address: contractAddress,
      event: txApprovedEvent,
      onLogs: (logs) => {
        setData((prev) => {
          const txMap = new Map<string, MultiSigTransaction>(
            prev.transactions.map((tx) => [tx.id.toLowerCase(), tx]),
          );
          let changed = false;

          for (const log of logs) {
            const args = log.args as { txHash?: string };
            const txHash = args.txHash?.toLowerCase();
            if (!txHash) continue;
            const tx = txMap.get(txHash);
            if (!tx) continue;
            txMap.set(txHash, { ...tx, status: "APPROVED" });
            changed = true;
          }

          if (!changed) return prev;
          return {
            ...prev,
            transactions: prev.transactions.map(
              (tx) => txMap.get(tx.id.toLowerCase()) ?? tx,
            ),
          };
        });
        fire();
      },
      onError: (err) => console.error("multisig txApproved watch error", err),
    });

    const unwatchExecuted = publicClient.watchEvent({
      address: contractAddress,
      event: executedEvent,
      onLogs: (logs) => {
        setData((prev) => {
          const txMap = new Map<string, MultiSigTransaction>(
            prev.transactions.map((tx) => [tx.id.toLowerCase(), tx]),
          );
          let changed = false;

          for (const log of logs) {
            const args = log.args as { txHash?: string; executor?: string };
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
            changed = true;
          }

          if (!changed) return prev;
          return {
            ...prev,
            transactions: prev.transactions.map(
              (tx) => txMap.get(tx.id.toLowerCase()) ?? tx,
            ),
          };
        });
        fire();
      },
      onError: (err) => console.error("multisig executed watch error", err),
    });

    const unwatchCanceled = publicClient.watchEvent({
      address: contractAddress,
      event: canceledEvent,
      onLogs: (logs) => {
        setData((prev) => {
          const txMap = new Map<string, MultiSigTransaction>(
            prev.transactions.map((tx) => [tx.id.toLowerCase(), tx]),
          );
          let changed = false;

          for (const log of logs) {
            const args = log.args as { txHash?: string };
            const txHash = args.txHash?.toLowerCase();
            if (!txHash) continue;
            const tx = txMap.get(txHash);
            if (!tx) continue;
            txMap.set(txHash, { ...tx, status: "CANCELED" });
            changed = true;
          }

          if (!changed) return prev;
          return {
            ...prev,
            transactions: prev.transactions.map(
              (tx) => txMap.get(tx.id.toLowerCase()) ?? tx,
            ),
          };
        });
        fire();
      },
      onError: (err) => console.error("multisig canceled watch error", err),
    });

    const unwatchSignerAdded = publicClient.watchEvent({
      address: contractAddress,
      event: signerAddedEvent,
      onLogs: (logs) => {
        setData((prev) => {
          if (!prev.wallet) return prev;
          let wallet = prev.wallet;

          for (const log of logs) {
            const args = log.args as { signer?: string };
            const signer = args.signer;
            if (!signer) continue;
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

          return { ...prev, wallet };
        });
        fire();
      },
      onError: (err) => console.error("multisig signerAdded watch error", err),
    });

    const unwatchSignerRemoved = publicClient.watchEvent({
      address: contractAddress,
      event: signerRemovedEvent,
      onLogs: (logs) => {
        setData((prev) => {
          if (!prev.wallet) return prev;
          let wallet = prev.wallet;

          for (const log of logs) {
            const args = log.args as { signer?: string };
            const signer = args.signer;
            if (!signer) continue;
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

          return { ...prev, wallet };
        });
        fire();
      },
      onError: (err) => console.error("multisig signerRemoved watch error", err),
    });

    const unwatchThreshold = publicClient.watchEvent({
      address: contractAddress,
      event: thresholdUpdatedEvent,
      onLogs: (logs) => {
        setData((prev) => {
          if (!prev.wallet) return prev;
          let wallet = prev.wallet;

          for (const log of logs) {
            const args = log.args as { newThreshold?: bigint };
            if (args.newThreshold === undefined) continue;
            wallet = { ...wallet, threshold: args.newThreshold.toString() };
          }

          return { ...prev, wallet };
        });
        fire();
      },
      onError: (err) => console.error("multisig threshold watch error", err),
    });

    return () => {
      unwatchProposed();
      unwatchApprovalAdded();
      unwatchTxApproved();
      unwatchExecuted();
      unwatchCanceled();
      unwatchSignerAdded();
      unwatchSignerRemoved();
      unwatchThreshold();
    };
  }, [active, publicClient, contractAddress, setData]);
}
