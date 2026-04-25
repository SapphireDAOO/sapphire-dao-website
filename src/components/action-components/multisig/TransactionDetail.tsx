"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useChainId, useWalletClient, usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { type AbiEvent, type Log, Address, encodeFunctionData, Hex } from "viem";
import { MultiSigTransaction } from "@/model/multisig";
import { useHasApproved } from "@/hooks/useHasApproved";
import { BASE_SEPOLIA, MULTISIG_CONTRACT } from "@/constants";
import {
  approveMultiSigTransaction,
  executeMultiSigTransaction,
  proposeMultiSigTransaction,
} from "@/services/blockchain/MultiSig";
import { Multisig } from "@/abis/MultiSig";
import {
  decodeMultiSigCalldata,
  formatAddress,
  formatTimestamp,
} from "./decodeCalldata";

const STATUS_BADGE: Record<string, string> = {
  PROPOSED: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  EXECUTED: "bg-green-100 text-green-800",
  CANCELED: "bg-red-100 text-red-800",
};

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

interface Props {
  tx: MultiSigTransaction | null;
  threshold: number;
  isSigner: boolean;
  cancelProposal: MultiSigTransaction | null;
  onClose: () => void;
  onActionSuccess: () => void;
  onApplyLogs: (logs: readonly Log[]) => void;
}

export default function TransactionDetail({
  tx,
  threshold,
  isSigner,
  cancelProposal,
  onClose,
  onActionSuccess,
  onApplyLogs,
}: Props) {
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId });

  const [isLoading, setIsLoading] = useState("");
  const [cancelActionLoading, setCancelActionLoading] = useState("");
  const [localApprovalCount, setLocalApprovalCount] = useState(0);
  const [localStatus, setLocalStatus] = useState<string>("PROPOSED");

  const onActionSuccessRef = useRef(onActionSuccess);
  onActionSuccessRef.current = onActionSuccess;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset local state when a different tx is opened
  useEffect(() => {
    if (tx) {
      setLocalApprovalCount(Number(tx.approvalCount));
      setLocalStatus(tx.status);
    }
  }, [tx?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: hasApproved, refetch: refetchHasApproved } = useHasApproved(
    tx?.id as Hex | undefined,
    address,
  );

  // hasApproved for the cancel proposal (always called; disabled when no cancelProposal)
  const { data: hasApprovedCancel, refetch: refetchHasApprovedCancel } = useHasApproved(
    cancelProposal?.id as Hex | undefined,
    address,
  );

  // Real-time event watchers for the specific tx
  useEffect(() => {
    if (!tx || !publicClient) return;

    const txHash = tx.id as Hex;
    const contractAddr = MULTISIG_CONTRACT[chainId];

    const unwatchApprovalAdded = publicClient.watchEvent({
      address: contractAddr,
      event: approvalAddedEvent,
      args: { txHash },
      onLogs: (logs) => {
        const log = logs[logs.length - 1];
        if (log?.args && "approvalCount" in log.args) {
          const newCount = Number(log.args.approvalCount as bigint);
          setLocalApprovalCount(newCount);
          if (newCount >= threshold) setLocalStatus("APPROVED");
        }
        void refetchHasApproved();
        onActionSuccessRef.current();
      },
    });

    const unwatchTxApproved = publicClient.watchEvent({
      address: contractAddr,
      event: txApprovedEvent,
      args: { txHash },
      onLogs: () => {
        setLocalStatus("APPROVED");
        onActionSuccessRef.current();
      },
    });

    const unwatchExecuted = publicClient.watchEvent({
      address: contractAddr,
      event: executedEvent,
      args: { txHash },
      onLogs: () => {
        setLocalStatus("EXECUTED");
        onActionSuccessRef.current();
        setTimeout(() => onCloseRef.current(), 1500);
      },
    });

    const unwatchCanceled = publicClient.watchEvent({
      address: contractAddr,
      event: canceledEvent,
      args: { txHash },
      onLogs: () => {
        setLocalStatus("CANCELED");
        onActionSuccessRef.current();
        setTimeout(() => onCloseRef.current(), 1500);
      },
    });

    return () => {
      unwatchApprovalAdded();
      unwatchTxApproved();
      unwatchExecuted();
      unwatchCanceled();
    };
  }, [tx?.id, publicClient, chainId, threshold]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tx) return null;

  const decoded = decodeMultiSigCalldata(tx.data);
  const remaining = Math.max(0, threshold - localApprovalCount);
  const isTerminal = localStatus === "EXECUTED" || localStatus === "CANCELED";

  // Main tx actions
  const canApprove = isSigner && !isTerminal && !hasApproved;
  // Threshold reached (locally or via subgraph) means any signer can execute
  const canExecute = isSigner && !isTerminal && (localStatus === "APPROVED" || localApprovalCount >= threshold);
  // Propose Cancel: only if no cancel proposal exists yet and tx is not terminal
  const canProposeCancelNew = isSigner && !isTerminal && !cancelProposal;

  // Cancel proposal actions
  const cancelApprovalCount = cancelProposal ? Number(cancelProposal.approvalCount) : 0;
  const cancelRemaining = Math.max(0, threshold - cancelApprovalCount);
  const cancelIsExecuted = cancelProposal?.status === "EXECUTED";
  const canApproveCancel =
    isSigner &&
    !!cancelProposal &&
    !isTerminal &&
    !cancelIsExecuted &&
    !hasApprovedCancel;
  const canExecuteCancel =
    isSigner &&
    !!cancelProposal &&
    !isTerminal &&
    (cancelProposal.status === "APPROVED" || cancelApprovalCount >= threshold);

  const handleApprove = async () => {
    if (!walletClient || !publicClient) return;
    const { ok, receipt } = await approveMultiSigTransaction(
      { walletClient, publicClient },
      tx.id as Hex,
      chainId,
      setIsLoading,
    );
    if (ok) {
      if (receipt) onApplyLogs(receipt.logs);
      void refetchHasApproved();
      onActionSuccess();
    }
  };

  const handleExecute = async () => {
    if (!walletClient || !publicClient) return;
    const { ok, receipt } = await executeMultiSigTransaction(
      { walletClient, publicClient },
      tx.id as Hex,
      chainId,
      setIsLoading,
    );
    if (ok) {
      if (receipt) onApplyLogs(receipt.logs);
      onActionSuccess();
      onClose();
    }
  };

  const handleProposeCancel = async () => {
    if (!walletClient || !publicClient) return;
    const calldata = encodeFunctionData({
      abi: Multisig,
      functionName: "cancelTransaction",
      args: [tx.id as `0x${string}`],
    });
    const { ok, receipt } = await proposeMultiSigTransaction(
      { walletClient, publicClient },
      MULTISIG_CONTRACT[chainId] as Address,
      calldata,
      chainId,
      setIsLoading,
    );
    if (ok) {
      if (receipt) onApplyLogs(receipt.logs);
      onActionSuccess();
    }
  };

  const handleApproveCancel = async () => {
    if (!walletClient || !publicClient || !cancelProposal) return;
    const { ok, receipt } = await approveMultiSigTransaction(
      { walletClient, publicClient },
      cancelProposal.id as Hex,
      chainId,
      setCancelActionLoading,
    );
    if (ok) {
      if (receipt) onApplyLogs(receipt.logs);
      void refetchHasApprovedCancel();
      onActionSuccess();
    }
  };

  const handleExecuteCancel = async () => {
    if (!walletClient || !publicClient || !cancelProposal) return;
    const { ok, receipt } = await executeMultiSigTransaction(
      { walletClient, publicClient },
      cancelProposal.id as Hex,
      chainId,
      setCancelActionLoading,
    );
    if (ok) {
      if (receipt) onApplyLogs(receipt.logs);
      onActionSuccess();
    }
  };

  return (
    <Dialog open={!!tx} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Transaction Detail
            <Badge className={STATUS_BADGE[localStatus] ?? ""}>{localStatus}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <Row label="Tx Hash">
            <a
              href={`https://sepolia.basescan.org/tx/${tx.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline flex items-center gap-1 font-mono"
            >
              {formatAddress(tx.id)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Row>

          <Row label="Target">
            <a
              href={`https://sepolia.basescan.org/address/${tx.target}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline flex items-center gap-1 font-mono"
            >
              {formatAddress(tx.target)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Row>

          {decoded ? (
            <div className="rounded-md bg-muted p-3 space-y-1">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                {decoded.contractLabel} — {decoded.functionLabel}
              </p>
              {decoded.params.map((p) => (
                <Row key={p.label} label={p.label}>
                  {p.href ? (
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline flex items-center gap-1 font-mono"
                    >
                      {p.value}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="font-mono">{p.value}</span>
                  )}
                </Row>
              ))}
            </div>
          ) : (
            <Row label="Calldata">
              <span className="font-mono text-xs break-all">{tx.data}</span>
            </Row>
          )}

          <Row label="Approvals">
            <span>
              {localApprovalCount} / {threshold}
              {remaining > 0 && !isTerminal && (
                <span className="ml-2 text-muted-foreground">
                  ({remaining} more needed)
                </span>
              )}
            </span>
          </Row>

          <Row label="Proposer">
            <a
              href={`https://sepolia.basescan.org/address/${tx.proposer}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline flex items-center gap-1 font-mono"
            >
              {formatAddress(tx.proposer)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Row>
          <Row label="Proposed At">{formatTimestamp(tx.proposedAt)}</Row>

          {tx.executedAt && (
            <>
              <Row label="Executed At">{formatTimestamp(tx.executedAt)}</Row>
              {tx.executor && (
                <Row label="Executor">
                  <a
                    href={`https://sepolia.basescan.org/address/${tx.executor}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline flex items-center gap-1 font-mono"
                  >
                    {formatAddress(tx.executor)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Row>
              )}
            </>
          )}

          {/* Cancel proposal — only shown while tx is still active (not executed or canceled) */}
          {cancelProposal && !isTerminal && (
            <div className="rounded-md border border-orange-200 bg-orange-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">
                  Cancel Proposal
                </p>
                <Badge className={STATUS_BADGE[cancelProposal.status] ?? ""}>
                  {cancelProposal.status}
                </Badge>
              </div>

              <Row label="Approvals">
                <span>
                  {cancelApprovalCount} / {threshold}
                  {cancelRemaining > 0 && !cancelIsExecuted && (
                    <span className="ml-2 text-muted-foreground">
                      ({cancelRemaining} more needed)
                    </span>
                  )}
                </span>
              </Row>

              {(canApproveCancel || canExecuteCancel || (hasApprovedCancel && !cancelIsExecuted)) && (
                <div className="flex gap-2 pt-1">
                  {canApproveCancel && (
                    <Button
                      size="sm"
                      className="flex-1"
                      variant="outline"
                      onClick={handleApproveCancel}
                      disabled={!!cancelActionLoading}
                    >
                      {cancelActionLoading.startsWith("approve") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Approve Cancel"
                      )}
                    </Button>
                  )}
                  {hasApprovedCancel && !cancelIsExecuted && (
                    <p className="text-xs text-muted-foreground flex items-center">
                      You approved cancel
                    </p>
                  )}
                  {canExecuteCancel && (
                    <Button
                      size="sm"
                      className="flex-1"
                      variant="destructive"
                      onClick={handleExecuteCancel}
                      disabled={!!cancelActionLoading}
                    >
                      {cancelActionLoading.startsWith("execute") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Execute Cancel"
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main tx actions */}
          <div className="flex gap-2 pt-2">
            {canApprove && (
              <Button
                className="flex-1"
                variant="outline"
                onClick={handleApprove}
                disabled={!!isLoading}
              >
                {isLoading.startsWith("approve") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Approve"
                )}
              </Button>
            )}
            {hasApproved && !isTerminal && (
              <p className="text-xs text-muted-foreground flex items-center">
                You approved this transaction
              </p>
            )}
            {canExecute && (
              <Button
                className="flex-1"
                onClick={handleExecute}
                disabled={!!isLoading}
              >
                {isLoading.startsWith("execute") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Execute"
                )}
              </Button>
            )}
            {canProposeCancelNew && (
              <Button
                className="flex-1"
                variant="destructive"
                onClick={handleProposeCancel}
                disabled={!!isLoading}
              >
                {isLoading.startsWith("propose") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Propose Cancel"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0 w-28">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
